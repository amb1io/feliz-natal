import { readdir, mkdir, cp, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const prismaMigrationsDir = path.resolve('prisma', 'migrations');
const targetDir = path.resolve('migrations');

async function main() {
  if (!existsSync(prismaMigrationsDir)) {
    console.error('Nenhuma pasta prisma/migrations encontrada. Execute primeiro as migrations com Prisma.');
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(prismaMigrationsDir, { withFileTypes: true });
  const items = entries.filter((entry) => entry.isDirectory()).map((dir) => dir.name).sort();

  if (!items.length) {
    console.warn('Nenhuma migration Prisma localizada para copiar.');
    return;
  }

  for (const name of items) {
    const sourceFile = path.join(prismaMigrationsDir, name, 'migration.sql');
    const destinationFile = path.join(targetDir, `${name}.sql`);

    try {
      const sourceInfo = await stat(sourceFile);
      if (!sourceInfo.isFile()) {
        console.warn(`Ignorando ${name}: migration.sql não encontrado.`);
        continue;
      }
    } catch (error) {
      console.warn(`Ignorando ${name}: ${error.message}`);
      continue;
    }

    if (existsSync(destinationFile)) {
      console.log(`Mantido ${name}.sql (já existe em migrations/)`);
      continue;
    }

    await cp(sourceFile, destinationFile);
    console.log(`Copiado ${name}.sql para migrations/`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
