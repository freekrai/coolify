import { asyncExecShell, saveBuildLog } from "$lib/common";

export default async function ({ applicationId, workdir, repodir, repository, branch, buildId, privateSshKey }): Promise<string> {
    try {
        saveBuildLog({ line: 'GitLab importer started.', buildId, applicationId })
        await asyncExecShell(`echo '${privateSshKey}' > ${repodir}/id.rsa`)
        await asyncExecShell(`git clone -q -b ${branch} git@gitlab.com:${repository}.git --config core.sshCommand="ssh -q -i ${repodir}/id.rsa -o StrictHostKeyChecking=no" ${workdir}/ && cd ${workdir}/ && git submodule update --init --recursive && cd ..`)
        const { stdout: commit } = await asyncExecShell(`cd ${workdir}/ && git rev-parse HEAD`)
        return commit.replace('\n', '')
        return 'OK'
    } catch (error) {
        throw new Error(error)
    }

}