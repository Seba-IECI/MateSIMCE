import "server-only";

// Pre-answer guidance uses public question text only: no choices, key, grade or
// private development. Fixed teaching rules cannot disclose a generated solution.
export function publicExerciseHint(statement: string, topic: string): string {
  const text = (statement + " " + topic).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/logaritmo|\\log/.test(text)) return "Un logaritmo pregunta por un exponente. Relaciona la base y el argumento con una potencia antes de operar; distingue las bases de los distintos logaritmos.";
  if (/promedio|media\b|mediana|moda/.test(text)) return "Distingue la medida que se pide: la media usa la suma y la cantidad de datos; la mediana requiere ordenarlos; la moda corresponde a la mayor frecuencia. Si cambian los datos, actualiza primero el conjunto.";
  if (/probabilidad|al azar|equiprobable/.test(text)) return "Define qué resultados cuentan para el evento pedido y cuáles son posibles. Revisa si hay reposición, independencia o una condición que reduzca el conjunto de casos; no supongas que todas las sumas son equiprobables.";
  if (/componente|desplazamiento|proyeccion|\\sin|\\cos|angulo/.test(text)) return "Identifica el eje y desde dónde se mide cada ángulo. Dibuja el triángulo rectángulo y distingue los catetos respecto de ese ángulo. Revisa también el sentido de cada componente antes de combinarla.";
  if (/vector|homotecia|coordenadas|se traslada/.test(text)) return "Trabaja cada coordenada por separado y respeta el orden de las transformaciones. Un mismo factor debe aplicarse a todas las componentes cuando la operación sea una multiplicación por un escalar.";
  if (/semejante|sombra|area|volumen|perimetro|geometria/.test(text)) return "Haz un esquema con las medidas dadas y la cantidad buscada. Distingue longitudes, áreas y volúmenes; sus unidades y factores de escala no son iguales. Usa solamente las relaciones justificadas por el enunciado.";
  if (/recuperar|inversa|deshacer/.test(text)) return "Anota las operaciones que realiza la transformación, en su orden. Para deshacerla, piensa en operaciones inversas en orden contrario y comprueba después la composición.";
  if (/factoriz|cuadrado|expresion|expresi[oó]n|polinom/.test(text)) return "Conserva los signos al distribuir y agrupa únicamente términos semejantes. Si hay cuadrados o diferencias de cuadrados, revisa la identidad completa antes de simplificar.";
  if (/funcion|ecuacion|entero.*satisface|algebra/.test(text)) return "Identifica la incógnita, su dominio y la relación que describen los datos. Representa esa relación antes de despejar y verifica al final las restricciones del enunciado.";
  if (/\\sqrt|raiz|raices/.test(text)) return "Busca factores que sean cuadrados perfectos dentro de cada raíz. Después comprueba qué términos tienen el mismo radical; no distribuyas una raíz sobre una suma.";
  if (/porcentaje|descuento|recargo|%/.test(text)) return "Identifica sobre qué cantidad se aplica cada porcentaje. Si hay cambios sucesivos, la base del segundo cambio puede ser distinta de la cantidad inicial.";
  if (/potencia|exponente|\\times10|\^/.test(text)) return "Distingue la base completa y el exponente, incluidos los paréntesis. Revisa la propiedad que corresponde a cada operación antes de calcular.";
  if (/\\frac|fraccion|retiran|trozos/.test(text)) return "Representa cada cantidad como una fracción y respeta el orden de las operaciones. Para sumar necesitas denominadores compatibles; al dividir, revisa cuál fracción se invierte.";
  return "Identifica qué cantidad se pide, los datos disponibles y sus unidades. Escribe una relación entre ellos antes de calcular y comprueba que tu resultado responda a la pregunta.";
}
