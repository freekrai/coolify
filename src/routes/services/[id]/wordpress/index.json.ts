import { getUserDetails } from '$lib/common';
import * as db from '$lib/database';
import { PrismaErrorHandler } from '$lib/database';
import type { RequestHandler } from '@sveltejs/kit';

export const post: RequestHandler<Locals> = async (event) => {
	const { status, body } = await getUserDetails(event);
	if (status === 401) return { status, body };
	const { id } = event.params;

	let {
		name,
		fqdn,
		wordpress: { extraConfig, mysqlDatabase }
	} = await event.request.json();
	if (fqdn) fqdn = fqdn.toLowerCase();

	try {
		await db.updateWordpress({ id, fqdn, name, extraConfig, mysqlDatabase });
		return { status: 201 };
	} catch (error) {
		return PrismaErrorHandler(error);
	}
};