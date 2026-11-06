-- Execute manually ONLY after approval, as postgres in the MateSIMCE SQL Editor.
-- Uses the verified remote schema. No question text, answer keys or credentials in this file.
-- No RLS/GRANT changes on existing tables. No changes to practice responses or diagnosis.
BEGIN;

-- Serialize direct REST inserts with saving/finalization too, not only application RPC calls.
CREATE OR REPLACE FUNCTION public.matesimce_guard_exam_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE
  parent public.intentos_ensayo%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.intento_ensayo_id IS NOT NULL AND (
      NEW.intento_ensayo_id IS DISTINCT FROM OLD.intento_ensayo_id OR
      NEW.pregunta_ensayo_id IS DISTINCT FROM OLD.pregunta_ensayo_id OR
      NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
    ) THEN RAISE EXCEPTION 'invalid'; END IF;
  END IF;
  IF NEW.pregunta_ensayo_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.intentos_ensayo
    WHERE id = NEW.intento_ensayo_id FOR UPDATE;
  IF NOT FOUND OR parent.estado <> 'en_curso' OR parent.usuario_id <> NEW.usuario_id
    OR NOT EXISTS (SELECT 1 FROM public.preguntas_ensayo
      WHERE id = NEW.pregunta_ensayo_id AND ensayo_id = parent.ensayo_id)
  THEN RAISE EXCEPTION 'invalid'; END IF;
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.matesimce_guard_exam_answer() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER matesimce_guard_exam_answer
BEFORE INSERT OR UPDATE ON public.respuestas_estudiante
FOR EACH ROW EXECUTE FUNCTION public.matesimce_guard_exam_answer();

-- A single transactional entry point. Identity comes from the caller's verified JWT.
-- Each attempt gets its own immutable-in-the-app question/solution copies in existing exam tables.
CREATE OR REPLACE FUNCTION public.matesimce_exam(
  p_operation text,
  p_attempt uuid DEFAULT NULL,
  p_question uuid DEFAULT NULL,
  p_selected integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE
  learner uuid := auth.uid();
  attempt public.intentos_ensayo%ROWTYPE;
  v_course_id uuid;
  v_course_count integer;
  snapshot jsonb;
  item jsonb;
  v_exam_id uuid;
  v_question_id uuid;
  v_attempt_id uuid;
  v_question_count integer;
  v_score integer;
  output_questions jsonb;
BEGIN
  IF learner IS NULL OR NOT public.usuario_tiene_rol(ARRAY['alumno']::text[])
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_operation IS NULL OR p_operation NOT IN ('resume','start','save','finish')
    OR (p_operation IN ('save','finish') AND p_attempt IS NULL)
    OR (p_operation = 'save' AND (p_question IS NULL OR p_selected IS NULL OR p_selected NOT BETWEEN 0 AND 3))
  THEN RAISE EXCEPTION 'invalid'; END IF;

  IF p_operation = 'start' THEN
    -- Serializes double-clicks and concurrent starts by the same student, across server instances.
    PERFORM pg_advisory_xact_lock(hashtextextended('matesimce-exam:' || learner::text, 0));
    SELECT i.* INTO attempt FROM public.intentos_ensayo i
      JOIN public.ensayos_simce e ON e.id = i.ensayo_id
      WHERE i.usuario_id = learner AND i.estado = 'en_curso'
        AND e.codigo LIKE 'matesimce-practica-12-v1:%'
      ORDER BY i.fecha_inicio DESC, i.id LIMIT 1 FOR UPDATE OF i;
    IF NOT FOUND THEN
      SELECT count(*), (array_agg(id))[1] INTO v_course_count, v_course_id
        FROM public.cursos WHERE activo AND nivel = '2_medio';
      IF v_course_count <> 1 THEN RAISE EXCEPTION 'content_unavailable'; END IF;

      -- One snapshot, including the verified private reference; nothing from it is returned raw.
      -- Same selector as diversify-practice-exam.sql. Snapshot identity uses the
      -- unchanged concat_ws separator verified in the deployed function.
      WITH latest_exam AS (
        SELECT i.ensayo_id FROM public.intentos_ensayo i
          JOIN public.ensayos_simce exam ON exam.id=i.ensayo_id
        WHERE i.usuario_id=learner AND i.estado='completado'
          AND exam.codigo LIKE 'matesimce-practica-12-v1:%'
        ORDER BY i.fecha_termino DESC, i.fecha_inicio DESC, i.id DESC LIMIT 1
      ), eligible AS (
        SELECT e.id, e.tema_id, t.categoria,
          concat_ws(E'\n\n', e.titulo, e.enunciado, nullif(e.instrucciones, '')) AS statement,
          e.opciones, s.respuesta_correcta, s.desarrollo_paso_a_paso,
          row_number() OVER (PARTITION BY t.categoria ORDER BY
            coalesce(history.in_latest,false), history.last_used NULLS FIRST, random(), e.id) AS position
        FROM public.ejercicios e
        JOIN public.temas t ON t.id = e.tema_id
        JOIN public.soluciones_ejercicios s ON s.ejercicio_id = e.id
        -- Existing snapshots have no source ID. Match the full statement, options and topic,
        -- never a title alone. Historical snapshots and responses remain unchanged.
        LEFT JOIN LATERAL (
          SELECT bool_or(q.ensayo_id=(SELECT ensayo_id FROM latest_exam)) AS in_latest,
            max(coalesce(i.fecha_termino,i.fecha_inicio)) AS last_used
          FROM public.preguntas_ensayo q
            JOIN public.intentos_ensayo i ON i.ensayo_id=q.ensayo_id
            JOIN public.ensayos_simce exam ON exam.id=i.ensayo_id
          WHERE i.usuario_id=learner AND i.estado IN ('completado','en_curso')
            AND exam.codigo LIKE 'matesimce-practica-12-v1:%'
            AND q.tema_id=e.tema_id AND q.opciones=e.opciones
            AND q.enunciado=concat_ws(E'\n\n', e.titulo, e.enunciado, nullif(e.instrucciones, ''))
        ) history ON true
        WHERE e.publicado AND t.activo AND t.curso_id = v_course_id
          AND t.categoria IN ('numeros','algebra_y_funciones','geometria','estadistica_y_probabilidades')
          AND e.tipo_respuesta = 'opcion_multiple' AND e.imagen_url IS NULL
          AND jsonb_typeof(e.opciones) = 'array'
          AND jsonb_array_length(e.opciones) = 4
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.opciones) AS o(value)
            WHERE jsonb_typeof(o.value) <> 'string' OR btrim(o.value #>> '{}') = '')
          AND (SELECT count(DISTINCT o.value) FROM jsonb_array_elements(e.opciones) AS o(value)) = 4
          AND s.respuesta_correcta->'version' = '1'::jsonb
          AND s.respuesta_correcta->>'tipo' = 'opcion_multiple'
          AND jsonb_typeof(s.respuesta_correcta->'indice_correcto') = 'number'
          AND s.respuesta_correcta->>'indice_correcto' IN ('0','1','2','3')
          AND btrim(s.desarrollo_paso_a_paso) <> ''
      ), chosen AS (
        SELECT *, row_number() OVER (ORDER BY categoria, position) AS number
        FROM eligible WHERE position <= 3
      )
      SELECT jsonb_agg(jsonb_build_object('topic',tema_id,'category',categoria,'number',number,
        'statement',statement,'choices',opciones,'answer',respuesta_correcta,
        'explanation',desarrollo_paso_a_paso) ORDER BY number) INTO snapshot FROM chosen;
      IF snapshot IS NULL OR jsonb_array_length(snapshot) <> 12
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot) AS q(value)
          GROUP BY q.value->>'category' HAVING count(*) <> 3)
      THEN RAISE EXCEPTION 'content_unavailable'; END IF;

      v_attempt_id := gen_random_uuid();
      INSERT INTO public.ensayos_simce(curso_id,codigo,titulo,descripcion,publicado)
        VALUES (v_course_id,'matesimce-practica-12-v1:' || v_attempt_id::text,
          'Ensayo tipo SIMCE — 12 preguntas',
          'Práctica de II medio: tres preguntas por eje. No es una evaluación ni un puntaje oficial SIMCE.',true)
        RETURNING id INTO v_exam_id;
      FOR item IN SELECT value FROM jsonb_array_elements(snapshot) LOOP
        INSERT INTO public.preguntas_ensayo(ensayo_id,tema_id,numero_pregunta,enunciado,tipo_respuesta,opciones,puntaje_maximo)
          VALUES (v_exam_id,(item->>'topic')::uuid,(item->>'number')::integer,item->>'statement','opcion_multiple',item->'choices',1)
          RETURNING id INTO v_question_id;
        INSERT INTO public.soluciones_preguntas_ensayo(pregunta_id,respuesta_correcta,desarrollo_paso_a_paso)
          VALUES (v_question_id,item->'answer',item->>'explanation');
      END LOOP;
      INSERT INTO public.intentos_ensayo(id,usuario_id,ensayo_id)
        VALUES (v_attempt_id,learner,v_exam_id) RETURNING * INTO attempt;
    END IF;
  ELSE
    SELECT i.* INTO attempt FROM public.intentos_ensayo i
      JOIN public.ensayos_simce e ON e.id = i.ensayo_id
      WHERE i.usuario_id = learner AND e.codigo LIKE 'matesimce-practica-12-v1:%'
        AND (p_attempt IS NULL OR i.id = p_attempt)
        AND i.estado IN ('en_curso','completado')
      ORDER BY (i.estado = 'en_curso') DESC, i.fecha_inicio DESC, i.id
      LIMIT 1 FOR UPDATE OF i;
    IF NOT FOUND THEN
      IF p_operation = 'resume' AND p_attempt IS NULL THEN RETURN NULL; END IF;
      RAISE EXCEPTION 'not_found';
    END IF;
  END IF;

  SELECT count(*) INTO v_question_count FROM public.preguntas_ensayo WHERE ensayo_id = attempt.ensayo_id;
  IF v_question_count <> 12 OR EXISTS (
    SELECT 1 FROM public.preguntas_ensayo q JOIN public.temas t ON t.id=q.tema_id
    WHERE q.ensayo_id=attempt.ensayo_id GROUP BY t.categoria HAVING count(*) <> 3
  ) THEN RAISE EXCEPTION 'content_unavailable'; END IF;

  -- A completed attempt is immutable. Repeated finish/save returns its existing result.
  IF p_operation = 'save' AND attempt.estado = 'en_curso' THEN
    IF NOT EXISTS (SELECT 1 FROM public.preguntas_ensayo
      WHERE id=p_question AND ensayo_id=attempt.ensayo_id)
    THEN RAISE EXCEPTION 'not_found'; END IF;
    IF EXISTS (SELECT 1 FROM public.respuestas_estudiante
      WHERE intento_ensayo_id=attempt.id AND pregunta_ensayo_id=p_question AND usuario_id<>learner)
    THEN RAISE EXCEPTION 'invalid'; END IF;
    INSERT INTO public.respuestas_estudiante(usuario_id,pregunta_ensayo_id,intento_ensayo_id,respuesta_json)
      VALUES (learner,p_question,attempt.id,
        jsonb_build_object('version',1,'tipo','opcion_multiple','indice_seleccionado',p_selected))
      ON CONFLICT (intento_ensayo_id,pregunta_ensayo_id) DO UPDATE
        SET respuesta_json=EXCLUDED.respuesta_json, respondido_en=now();
  END IF;

  IF p_operation = 'finish' AND attempt.estado = 'en_curso' THEN
    IF (SELECT count(*) FROM public.preguntas_ensayo q
      JOIN public.soluciones_preguntas_ensayo s ON s.pregunta_id=q.id
      WHERE q.ensayo_id=attempt.ensayo_id
        AND s.respuesta_correcta->'version'='1'::jsonb
        AND s.respuesta_correcta->>'tipo'='opcion_multiple'
        AND s.respuesta_correcta->>'indice_correcto' IN ('0','1','2','3')
        AND jsonb_typeof(s.respuesta_correcta->'indice_correcto')='number'
        AND btrim(s.desarrollo_paso_a_paso)<>''
    ) <> 12 THEN RAISE EXCEPTION 'content_unavailable'; END IF;
    IF EXISTS (SELECT 1 FROM public.respuestas_estudiante r
      WHERE r.intento_ensayo_id=attempt.id AND (
        r.usuario_id<>learner OR r.ejercicio_id IS NOT NULL
        OR r.respuesta_json->'version' IS DISTINCT FROM '1'::jsonb
        OR r.respuesta_json->>'tipo' IS DISTINCT FROM 'opcion_multiple'
        OR jsonb_typeof(r.respuesta_json->'indice_seleccionado') IS DISTINCT FROM 'number'
        OR (r.respuesta_json->>'indice_seleccionado' IN ('0','1','2','3')) IS NOT TRUE
        OR NOT EXISTS (SELECT 1 FROM public.preguntas_ensayo q
          WHERE q.id=r.pregunta_ensayo_id AND q.ensayo_id=attempt.ensayo_id)
      )) THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE public.respuestas_estudiante r
      SET es_correcta=((r.respuesta_json->>'indice_seleccionado')::integer=(s.respuesta_correcta->>'indice_correcto')::integer),
        puntaje_obtenido=CASE WHEN (r.respuesta_json->>'indice_seleccionado')::integer=(s.respuesta_correcta->>'indice_correcto')::integer THEN 1 ELSE 0 END
      FROM public.preguntas_ensayo q JOIN public.soluciones_preguntas_ensayo s ON s.pregunta_id=q.id
      WHERE r.pregunta_ensayo_id=q.id AND r.intento_ensayo_id=attempt.id AND r.usuario_id=learner
        AND q.ensayo_id=attempt.ensayo_id;
    SELECT count(*) INTO v_score FROM public.respuestas_estudiante
      WHERE intento_ensayo_id=attempt.id AND usuario_id=learner AND es_correcta IS TRUE;
    UPDATE public.intentos_ensayo SET estado='completado',puntaje_obtenido=v_score,fecha_termino=now()
      WHERE id=attempt.id RETURNING * INTO attempt;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',q.id,'number',q.numero_pregunta,'category',t.categoria,
    'statement',q.enunciado,'choices',q.opciones,
    'selectedIndex',CASE WHEN r.respuesta_json->>'indice_seleccionado' IN ('0','1','2','3')
      THEN (r.respuesta_json->>'indice_seleccionado')::integer ELSE NULL END
    ) || CASE WHEN attempt.estado='completado' THEN jsonb_build_object(
      'correctIndex',(s.respuesta_correcta->>'indice_correcto')::integer,
      'explanation',s.desarrollo_paso_a_paso) ELSE '{}'::jsonb END
    ORDER BY q.numero_pregunta) INTO output_questions
    FROM public.preguntas_ensayo q JOIN public.temas t ON t.id=q.tema_id
    LEFT JOIN public.respuestas_estudiante r
      ON r.pregunta_ensayo_id=q.id AND r.intento_ensayo_id=attempt.id AND r.usuario_id=learner
    LEFT JOIN public.soluciones_preguntas_ensayo s ON s.pregunta_id=q.id
    WHERE q.ensayo_id=attempt.ensayo_id;
  RETURN jsonb_build_object('id',attempt.id,'state',attempt.estado,
    'startedAt',attempt.fecha_inicio,'finishedAt',attempt.fecha_termino,
    'score',attempt.puntaje_obtenido,'questions',output_questions);
END;
$body$;
REVOKE ALL ON FUNCTION public.matesimce_exam(text,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matesimce_exam(text,uuid,uuid,integer) TO authenticated;
COMMIT;
