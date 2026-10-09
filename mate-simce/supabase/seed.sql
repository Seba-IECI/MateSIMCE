-- Solo para el modelo nuevo. No crea cuentas Auth, participantes ni credenciales.
BEGIN;

INSERT INTO public.roles (nombre, descripcion)
VALUES
  ('profesor', 'Docente que administra material educativo y acompaña el aprendizaje.'),
  ('administrador', 'Responsable de la administración general de la plataforma.')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = true;

WITH curso_base AS (
  INSERT INTO public.cursos (nombre, nivel, descripcion)
  VALUES (
    'Matemática de 2° medio',
    '2_medio',
    'Curso de práctica y reforzamiento de matemática para estudiantes de segundo medio en Chile.'
  )
  ON CONFLICT (nivel, nombre) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true
  RETURNING id
)
INSERT INTO public.temas (curso_id, nombre, categoria, descripcion, orden)
SELECT
  curso_base.id,
  tema.nombre,
  tema.categoria,
  tema.descripcion,
  tema.orden
FROM curso_base
CROSS JOIN (
  VALUES
    ('Números', 'numeros', 'Práctica de números, potencias, raíces y proporcionalidad.', 1),
    ('Geometría', 'geometria', 'Práctica de figuras, medidas, áreas y relaciones geométricas.', 2),
    ('Álgebra y funciones', 'algebra_y_funciones', 'Práctica de expresiones algebraicas, ecuaciones, relaciones y funciones.', 3),
    ('Estadística y probabilidades', 'estadistica_y_probabilidades', 'Práctica de análisis de datos, representaciones y situaciones de azar.', 4)
) AS tema(nombre, categoria, descripcion, orden)
ON CONFLICT (curso_id, nombre) DO UPDATE
SET categoria = EXCLUDED.categoria,
    descripcion = EXCLUDED.descripcion,
    orden = EXCLUDED.orden,
    activo = true;

COMMIT;
