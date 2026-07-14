import { expect, it } from 'vitest';
import { reconcileProtectedIdentity, restoreProtectedIdentity } from '../../src/domain/protected-fields';

it('restores uid and key from the latest valid runtime snapshot', () => {
	const metadata = { uid: 'changed', key: 'CHANGED-9' };
	const result = restoreProtectedIdentity(metadata, { uid: 'stable', key: 'PROJ-1' });
	expect(result.changed).toBe(true);
	expect(metadata).toEqual({ uid: 'stable', key: 'PROJ-1' });
});

it('does not restore an old key while an authorized migration is in progress', () => {
	const metadata = { uid: 'stable', key: 'PROJ-1' };
	const result = reconcileProtectedIdentity(
		metadata,
		{ uid: 'stable', key: 'PROJ-1' },
		{ uid: 'stable', key: 'OPS-2' },
	);
	expect(result).toEqual({ changed: false, authorizationComplete: false });
	expect(metadata.key).toBe('PROJ-1');
	metadata.key = 'OPS-2';
	expect(reconcileProtectedIdentity(metadata, { uid: 'stable', key: 'PROJ-1' }, { uid: 'stable', key: 'OPS-2' }).authorizationComplete).toBe(true);
});
