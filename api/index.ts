import type { IncomingMessage, ServerResponse } from 'http';
import { createExpressApp } from '../src/server/app.js';

const app = createExpressApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as any)(req, res);
}
