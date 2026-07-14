export interface ProtectedIdentity {
	uid: string;
	key: string;
}

export function restoreProtectedIdentity(
	metadata: ProtectedIdentity,
	snapshot: ProtectedIdentity,
): { changed: boolean } {
	const changed = metadata.uid !== snapshot.uid || metadata.key !== snapshot.key;
	if (changed) {
		metadata.uid = snapshot.uid;
		metadata.key = snapshot.key;
	}
	return { changed };
}

export function reconcileProtectedIdentity(
	metadata: ProtectedIdentity,
	snapshot: ProtectedIdentity,
	authorized?: ProtectedIdentity,
): { changed: boolean; authorizationComplete: boolean } {
	if (authorized) {
		return {
			changed: false,
			authorizationComplete:
				metadata.uid === authorized.uid && metadata.key === authorized.key,
		};
	}
	return {
		...restoreProtectedIdentity(metadata, snapshot),
		authorizationComplete: false,
	};
}
