import { createHash } from 'node:crypto';
import { access, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type MsiBuildResult =
  | { status: 'blocked'; version: string; reason: string }
  | { status: 'failed'; version: string; reason: string; log: string }
  | { status: 'succeeded'; version: string; artifactPath: string; sha256: string; sizeBytes: number };

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let output = '';
    child.stdout.on('data', value => { output += value.toString(); });
    child.stderr.on('data', value => { output += value.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });
}

export async function buildVersionedMsi(version: string): Promise<MsiBuildResult> {
  const root = process.env.SENTINELPULSE_PROJECT_ROOT ?? process.cwd();
  const publishDir = process.env.SENTINELPULSE_AGENT_PUBLISH_DIR ?? path.join(root, 'agent', 'publish');
  const wixSource = path.join(root, 'agent', 'packaging', 'sentinelpulse-agent.wxs');
  const artifactDir = process.env.SENTINELPULSE_ARTIFACT_DIR ?? path.join(root, 'artifacts', 'msi');
  const artifactPath = path.join(artifactDir, `SentinelPulseAgent-${version}-x64.msi`);

  try {
    await access(wixSource);
    await access(path.join(publishDir, 'SentinelPulse.Agent.exe'));
  } catch {
    return { status: 'blocked', version, reason: 'A Windows-published agent or WiX source is not available in this environment.' };
  }

  await mkdir(artifactDir, { recursive: true });
  const numericVersion = `${version.replace(/[-+].*$/, '')}.0`;
  const result = await run('wix', [
    'build',
    '-arch', 'x64',
    `-dAgentVersion=${numericVersion}`,
    `-dAgentSemVer=${version}`,
    `-dPublishDir=${publishDir}`,
    wixSource,
    '-o', artifactPath,
  ], root).catch(error => ({ code: 1, output: error instanceof Error ? error.message : String(error) }));

  if (result.code !== 0) return { status: 'failed', version, reason: 'WiX compilation failed.', log: result.output.slice(-20_000) };
  const metadata = await stat(artifactPath);
  if (metadata.size === 0) return { status: 'failed', version, reason: 'WiX returned success but produced an empty MSI.', log: result.output };
  const bytes = await (await import('node:fs/promises')).readFile(artifactPath);
  return { status: 'succeeded', version, artifactPath, sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: metadata.size };
}
