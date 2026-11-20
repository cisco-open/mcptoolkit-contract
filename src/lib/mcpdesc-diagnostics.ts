import type {
  McpDescriptionDiagnosticDetail,
  McpDescriptionRelatedLocation,
} from '@mcpdesc/validator';

export interface McpDescriptionDiagnosticLike {
  code?: string;
  rule?: string;
  message?: string;
  path?: readonly (string | number)[];
  detail?: McpDescriptionDiagnosticDetail;
  relatedLocations?: readonly McpDescriptionRelatedLocation[];
}

function formatPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return '/';
  return `/${path
    .map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/')}`;
}

export function formatMcpDescriptionDiagnostic(diagnostic: McpDescriptionDiagnosticLike): string {
  const label = diagnostic.code ?? diagnostic.rule ?? 'diagnostic';
  const path = diagnostic.path ? ` at ${formatPath(diagnostic.path)}` : '';
  const lines = [`${label}${path}: ${diagnostic.message ?? 'No message provided'}`];
  if (diagnostic.detail) {
    lines.push(`  Detail: ${JSON.stringify(diagnostic.detail)}`);
  }
  for (const related of diagnostic.relatedLocations ?? []) {
    lines.push(`  Related location: ${formatPath(related.path)} (${related.relation})`);
  }
  return lines.join('\n');
}
