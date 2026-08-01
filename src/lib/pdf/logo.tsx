// Logo de Ancora para el PDF de presupuesto.
//
// PLACEHOLDER. Ancora no nos ha facilitado todavía el logo vectorial (CLAUDE.md
// sección 10, pendientes 11 y 23) y en el repositorio no hay ningún asset de
// marca: no existe siquiera carpeta `public/`. Extraerlo por captura de un PDF
// antiguo daría un bitmap pixelado en impresión, que es peor que no ponerlo.
//
// Mientras tanto se dibuja la misma marca provisional que ya usa el preview
// HTML: disco en el azul-cyan corporativo con la inicial en blanco. Se compone
// con primitivas de layout (`View` + `Text`) en lugar de un base64: `Image` de
// @react-pdf/renderer solo admite PNG/JPG, así que un placeholder embebido
// sería un bitmap de baja resolución con el mismo problema que evitamos.
//
// Al sustituirlo por el logo real basta con cambiar este archivo por un
// `<Image src={...} />`; nadie más conoce su implementación.

import { Text, View } from "@react-pdf/renderer";
import { COLOR } from "./styles";

interface LogoAncoraProps {
  /** Diámetro en puntos. 34 pt ≈ 12 mm, la altura de cabecera del Prompt 7. */
  tamano?: number;
}

export function LogoAncora({ tamano = 34 }: LogoAncoraProps) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: COLOR.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize: tamano * 0.5,
          color: "#ffffff",
        }}
      >
        A
      </Text>
    </View>
  );
}
