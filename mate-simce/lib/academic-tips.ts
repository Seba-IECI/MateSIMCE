export const TIP_SESSION_KEY = "matesimce-academic-tips-v1";

export const academicTips = [
  { axis: "Números", text: "Un exponente negativo indica un recíproco si la base es distinta de cero. No cambia por sí solo el signo del resultado." },
  { axis: "Números", text: "Para sumar fracciones, expresa primero sus valores con un denominador común. El numerador y el denominador deben multiplicarse por el mismo factor." },
  { axis: "Números", text: "Antes de sumar raíces, simplifícalas y comprueba si tienen el mismo radical. La raíz de una suma no se distribuye sobre sus términos." },
  { axis: "Números", text: "En cambios porcentuales sucesivos, identifica la base de cada porcentaje. Un descuento y un aumento del mismo porcentaje no suelen anularse." },
  { axis: "Números", text: "Comprueba los paréntesis antes de calcular una potencia. Elevar un número negativo no siempre equivale a cambiar el signo de una potencia positiva." },
  { axis: "Álgebra y funciones", text: "Antes de resolver una ecuación, identifica la incógnita. Comprueba la solución sustituyéndola en la ecuación original." },
  { axis: "Álgebra y funciones", text: "Al distribuir un factor, multiplícalo por cada término del paréntesis. Si el factor es negativo, revisa todos los signos." },
  { axis: "Álgebra y funciones", text: "Agrupa solamente términos semejantes: deben tener las mismas variables elevadas a los mismos exponentes." },
  { axis: "Álgebra y funciones", text: "Para calcular el valor de una función, sustituye la entrada completa entre paréntesis. Respeta después el orden de las operaciones." },
  { axis: "Álgebra y funciones", text: "Al despejar, realiza la misma operación en ambos miembros de la ecuación. Antes de dividir por una expresión, comprueba que no sea cero." },
  { axis: "Geometría", text: "Revisa las unidades: una longitud usa unidades lineales; un área, cuadradas; un volumen, cúbicas." },
  { axis: "Geometría", text: "En un triángulo rectángulo, identifica primero la hipotenusa. Está frente al ángulo recto y es el lado de mayor longitud." },
  { axis: "Geometría", text: "Para usar seno o coseno, identifica desde qué ángulo se mide la razón. Los catetos opuesto y adyacente dependen del ángulo elegido." },
  { axis: "Geometría", text: "Si una figura se amplía por un factor positivo, las longitudes se multiplican por ese factor y las áreas por su cuadrado." },
  { axis: "Geometría", text: "Al sumar componentes de desplazamientos, elige un sentido positivo para cada eje. Los signos deben representar los sentidos de las componentes." },
  { axis: "Estadística y probabilidades", text: "La razón entre casos favorables y posibles se aplica cuando los resultados elementales son equiprobables. Comprueba esa condición antes de usarla." },
  { axis: "Estadística y probabilidades", text: "Para encontrar la mediana, ordena primero los datos. Si hay una cantidad par, promedia los dos valores centrales." },
  { axis: "Estadística y probabilidades", text: "La media utiliza todos los valores y puede cambiar mucho por un dato extremo. Compárala con la mediana para interpretar el conjunto." },
  { axis: "Estadística y probabilidades", text: "En extracciones sucesivas, revisa si hay reposición. Sin reposición, cambian los elementos disponibles y pueden cambiar las probabilidades." },
  { axis: "Estadística y probabilidades", text: "Antes de interpretar un gráfico, revisa los ejes, sus escalas y las unidades. Una diferencia visual no siempre representa la misma diferencia numérica." },
] as const;

export type TipSession = { order: number[]; position: number };
type TipStorage = Pick<Storage, "getItem" | "setItem">;

export function saveTipSession(session: TipSession, storage?: TipStorage) {
  try { storage?.setItem(TIP_SESSION_KEY, JSON.stringify(session)); } catch { /* El carrusel sigue funcionando sin almacenamiento. */ }
}

// Nueva sesión visual: primer dashboard de la pestaña o nuevo login completado.
// sessionStorage conserva orden y posición en recargas y navegación; no guarda identidad.
export function loadTipSession(storage?: TipStorage, random = Math.random): TipSession {
  try {
    const stored: unknown = JSON.parse(storage?.getItem(TIP_SESSION_KEY) ?? "null");
    if (stored && typeof stored === "object" && "order" in stored && "position" in stored) {
      const { order, position } = stored;
      if (Array.isArray(order) && order.length === academicTips.length && new Set(order).size === academicTips.length
        && order.every((i) => Number.isInteger(i) && i >= 0 && i < academicTips.length)
        && typeof position === "number" && Number.isInteger(position) && position >= 0 && position < academicTips.length) return { order, position };
    }
  } catch { /* Ignorar datos locales incompletos o no disponibles. */ }
  const order = academicTips.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const session = { order, position: 0 };
  saveTipSession(session, storage);
  return session;
}
