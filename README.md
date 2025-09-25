ECO-HÉROES — Navegación multipágina

Este proyecto convierte la landing estática en una navegación multipágina manteniendo el mismo look & feel.

Estructura

- index.html (Landing principal)
- evento.html
- inscripcion.html
- puntajes.html
- podio.html
- programas.html
- styles.css (estilos compartidos)
- script.js (funcionalidad de la landing)
- Imágenes en la raíz (ej.: "imagen 2. logo usb.png", "imagen 3. eco-heroes.jpg", etc.)

Navegación

En index.html el navbar abre cada sección en una nueva pestaña (target="_blank") con rel="noopener noreferrer".

Cada subpágina:
- Reutiliza header/nav/footer y estilos.
- Marca el link activo con aria-current="page".
- Incluye un hero, breadcrumb "Inicio > Sección" y un botón "Volver a la Landing" (abre en la misma pestaña).

Editar contenido

- Sustituye los textos de marcador de posición en el main de cada subpágina.
- Puedes replicar componentes de index.html si deseas traer formularios o tablas.

Accesibilidad

- Todos los enlaces que abren en nueva pestaña usan rel="noopener noreferrer".
- Subpáginas usan aria-current="page" en el nav.

Responsive

- Se mantienen los mismos estilos (styles.css). No se añadieron frameworks.

Criterios de aceptación

- Clic en Evento/Inscripción/Puntajes/Podio/Programas desde la landing abre la subpágina correspondiente en nueva pestaña.
- Diseño y estilos consistentes. Sin errores en consola.


