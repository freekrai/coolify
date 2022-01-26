import { asyncExecShell, getEngine } from '$lib/common';
import { dockerInstance } from '$lib/docker';
import { defaultProxyImageHttp, defaultProxyImageTcp, startCoolifyProxy } from '$lib/haproxy';
import { getDatabaseImage } from '.';
import { prisma, PrismaErrorHandler } from './common';

export async function listDestinations(teamId) {
	return await prisma.destinationDocker.findMany({ where: { teams: { every: { id: teamId } } } });
}

export async function configureDestinationForService({ id, destinationId }) {
	return await prisma.service.update({
		where: { id },
		data: { destinationDocker: { connect: { id: destinationId } } }
	});
}
export async function configureDestinationForApplication({ id, destinationId }) {
	return await prisma.application.update({
		where: { id },
		data: { destinationDocker: { connect: { id: destinationId } } }
	});
}
export async function configureDestinationForDatabase({ id, destinationId }) {
	await prisma.database.update({
		where: { id },
		data: { destinationDocker: { connect: { id: destinationId } } }
	});

	const {
		destinationDockerId,
		destinationDocker: { engine },
		version,
		type
	} = await prisma.database.findUnique({ where: { id }, include: { destinationDocker: true } });

	if (destinationDockerId) {
		const host = getEngine(engine);
		if (type && version) {
			const baseImage = getDatabaseImage(type);
			asyncExecShell(`DOCKER_HOST=${host} docker pull ${baseImage}:${version}`);
			asyncExecShell(`DOCKER_HOST=${host} docker pull coollabsio/${defaultProxyImageTcp}`);
			asyncExecShell(`DOCKER_HOST=${host} docker pull coollabsio/${defaultProxyImageHttp}`);
			asyncExecShell(`DOCKER_HOST=${host} docker pull certbot/certbot:latest`);
			asyncExecShell(`DOCKER_HOST=${host} docker pull alpine:latest`);
		}
	}
}
export async function updateDestination({ id, name, engine, network }) {
	return await prisma.destinationDocker.update({ where: { id }, data: { name, engine, network } });
}

export async function newDestination({ name, teamId, engine, network, isCoolifyProxyUsed }) {
	const host = getEngine(engine);
	const docker = dockerInstance({ destinationDocker: { engine, network } });
	const found = await docker.engine.listNetworks({ filters: { name: [`^${network}$`] } });
	console.log(found);
	if (found.length === 0) {
		await asyncExecShell(`DOCKER_HOST=${host} docker network create --attachable ${network}`);
	}
	await prisma.destinationDocker.create({
		data: { name, teams: { connect: { id: teamId } }, engine, network, isCoolifyProxyUsed }
	});
	const destinations = await prisma.destinationDocker.findMany({ where: { engine } });
	const destination = destinations.find((destination) => destination.network === network);

	if (destinations.length > 0) {
		const proxyConfigured = destinations.find(
			(destination) => destination.network !== network && destination.isCoolifyProxyUsed === true
		);
		if (proxyConfigured) {
			if (proxyConfigured.isCoolifyProxyUsed) {
				isCoolifyProxyUsed = true;
			} else {
				isCoolifyProxyUsed = false;
			}
		}
		await prisma.destinationDocker.updateMany({ where: { engine }, data: { isCoolifyProxyUsed } });
	}
	if (isCoolifyProxyUsed) await startCoolifyProxy(engine);
	return destination.id;
}
export async function removeDestination({ id }) {
	const destination = await prisma.destinationDocker.delete({ where: { id } });
	if (destination.isCoolifyProxyUsed) {
		const host = getEngine(destination.engine);
		const { network } = destination;
		const { stdout: found } = await asyncExecShell(
			`DOCKER_HOST=${host} docker ps -a --filter network=${network} --filter name=coolify-haproxy --format '{{.}}'`
		);
		if (found) {
			await asyncExecShell(
				`DOCKER_HOST="${host}" docker network disconnect ${network} coolify-haproxy`
			);
			await asyncExecShell(`DOCKER_HOST="${host}" docker network rm ${network}`);
		}
	}
}

export async function getDestination({ id, teamId }) {
	return await prisma.destinationDocker.findFirst({
		where: { id, teams: { every: { id: teamId } } }
	});
}
export async function getDestinationByApplicationId({ id, teamId }) {
	return await prisma.destinationDocker.findFirst({
		where: { application: { some: { id } }, teams: { every: { id: teamId } } }
	});
}

export async function setDestinationSettings({ engine, isCoolifyProxyUsed }) {
	return await prisma.destinationDocker.updateMany({
		where: { engine },
		data: { isCoolifyProxyUsed }
	});

	// if (isCoolifyProxyUsed) {
	//     await installCoolifyProxy(engine)
	//     await configureNetworkCoolifyProxy(engine)
	// } else {
	//     // TODO: must check if other destination is using the proxy??? or not?
	//     const domain = await prisma.setting.findUnique({ where: { name: 'domain' }, rejectOnNotFound: false })
	//     if (!domain) {
	//         await uninstallCoolifyProxy(engine)
	//     } else {
	//         return {
	//             stastus: 500,
	//             body: {
	//                 message: 'You can not disable the Coolify proxy while the domain is set for Coolify itself.'
	//             }
	//         }
	//     }
	// }
}
