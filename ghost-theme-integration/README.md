# Theme Integration Guide

## Installation

### 1. Copy Assets

Copy the `heart` folder to your theme's `assets` directory:
```
your-theme/assets/theme/components/heart/
├── heart.js
└── heart.css
```

### 2. Update default.hbs

Add before `</body>`:

```handlebars
{{!-- Applause Button System --}}
<link rel="stylesheet" type="text/css" href="{{asset "theme/components/heart.css"}}">
<script defer src="{{asset "theme/components/heart.js"}}"></script>
<a id="applause-portal-signin" data-portal="signin" hidden></a>
```

### 3. Add Button to Posts
In your post.hbs or wherever you want the button:

```handlebars
<applause-button></applause-button>
```

## Customization
### Color Options

```html
<!-- Use theme accent color (default) -->
<applause-button></applause-button>

<!-- Custom color -->
<applause-button color="#e91e63"></applause-button>
```

### Styling
The button automatically inherits your theme's accent color via --ghost-accent-color.

## Examples
See templates/ folder for example implementations.