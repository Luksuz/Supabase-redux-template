// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth-options';

export const { GET, POST } = handlers;