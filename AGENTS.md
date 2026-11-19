# Brújula Empleo

- Mantén el frontend en React y TypeScript. Los componentes principales están en `src/main.tsx` y los estilos y tokens en `src/style.css`.
- Reutiliza `.button`, sus variantes `.primary` y `.secondary`, y `.icon-button` para acciones con icono. Usa Lucide React y un nombre accesible en los controles sin texto.
- Usa `.panel` para superficies, `Toast` para confirmaciones temporales, `Notice` para avisos que deben seguir visibles y `Empty` para estados vacíos. Conserva los tokens de color, borde, radio y movimiento definidos en `:root`.
- Mantén la navegación y el detalle de ofertas utilizables en móvil, con teclado y con movimiento reducido. Usa los controles nativos para la selección de archivos y opciones. Reutiliza los estilos y tokens de campo de `src/style.css` para entradas de texto y selectores.
- Verifica con `npm run build` y `npm run check`. Abre el navegador para pruebas solo si el usuario lo solicita.
- Reutiliza `Loading` para cargas de listas y formularios. En resultados, la lista y el detalle se desplazan de forma independiente. Conserva la posición de la lista al cambiar de oferta.
