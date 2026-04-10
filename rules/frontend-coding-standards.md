# Frontend Coding Standards (React)

## 1. General Principles
- Follow clean code practices: readability, simplicity, maintainability
- Use consistent formatting (Prettier + ESLint)
- Prefer modular, reusable components
- Avoid duplication (DRY)

---

## 2. Project Structure
```
src/
  components/
  pages/
  hooks/
  services/
  utils/
  styles/
  context/
```

---

## 3. Naming Conventions
- camelCase → variables, functions
- PascalCase → components
- UPPER_CASE → constants

Files:
- Components: UserProfile.jsx
- Hooks: useAuth.js
- Services: userService.js

---

## 4. Component Design
- Use functional components with hooks
- Keep components small and focused
- Avoid monolithic components

---

## 5. Hooks
- Use built-in hooks properly
- Create custom hooks for reusable logic
- Optimize using useMemo, useCallback

---

## 6. State Management
- Local state → UI logic
- Global state → Context API / Redux
- Avoid deeply nested state

---

## 7. Props
- Validate using PropTypes or TypeScript
- Avoid excessive props (use objects)

---

## 8. API Calls
- Keep API calls in services layer
- Use axios/fetch wrapper
- Handle loading & error states

---

## 9. Styling
- Use CSS modules / styled-components / Tailwind
- Avoid inline styles

---

## 10. Performance
- Use lazy loading
- Optimize assets (images, bundles)
- Avoid unnecessary re-renders

---

## 11. Testing
- Write unit tests (Jest, React Testing Library)

---

## 12. Code Quality Tools
- ESLint
- Prettier
- Husky

---

## 13. Best Practices Summary
- Reusable components
- Separation of concerns
- Maintainable and testable UI code
