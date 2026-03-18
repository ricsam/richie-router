import { startDocsServer } from './app';

const server = startDocsServer({
  port: Number(process.env.PORT ?? 3001),
});

console.log(`@richie-router/ docs running at ${server.url}`);
