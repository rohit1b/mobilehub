# MobileHub (Docker ke bina)
Requirements: Node.js 18+ aur PostgreSQL (localhost:5432, user postgres / password postgres)

    npm run setup     # sab folders me npm install + 4 databases banata hai
    npm start         # 4 microservices + gateway + React ek saath

Alag user/password ho to: DB_USER=... DB_PASS=... npm run setup (start ke time bhi same env do).
Shop: http://localhost:5173 | Swagger: http://localhost:8080/docs | Admin: admin@mobilehub.com / admin123
