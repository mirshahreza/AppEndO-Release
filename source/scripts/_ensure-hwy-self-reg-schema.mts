import { ensureHwyMembersSelfRegistrationSchema } from '../src/server/domain/hwy/ensureHwyMembersSelfRegistrationSchema.ts';

await ensureHwyMembersSelfRegistrationSchema();
console.log('hwy self-registration member schema ready');
