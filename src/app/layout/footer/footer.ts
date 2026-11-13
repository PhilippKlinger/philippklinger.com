import { Component, inject, makeStateKey, TransferState } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuildInfo, buildLineTexts, buildRunUrl } from '../../../content/build-info';
import { profile } from '../../../content/profile';
import { docsUrl, repositoryUrl } from '../../../content/site';
import { BUILD_INFO } from './build-info-token';
import { ExternalLink } from '../../external-link';

const BUILD_INFO_KEY = makeStateKey<BuildInfo | null>('build-info');

// The browser has no build file, so the prerender hands the value over for an equal hydration.
function handedOverBuildInfo(): BuildInfo | null {
  const state = inject(TransferState);
  const fromBuild = inject(BUILD_INFO);
  if (fromBuild) state.set(BUILD_INFO_KEY, fromBuild);
  return state.get(BUILD_INFO_KEY, null);
}

function linkToRun(info: BuildInfo | null): { url: string; label: string } | null {
  if (!info) return null;
  const shortSha = info.sha.slice(0, 7);
  return { url: buildRunUrl(info, repositoryUrl), label: `${buildLineTexts.build} ${shortSha}` };
}

@Component({
  selector: 'app-footer',
  imports: [ExternalLink, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly profile = profile;
  protected readonly docsUrl = docsUrl;
  protected readonly year = new Date().getFullYear();
  protected readonly buildLine = buildLineTexts;
  protected readonly allRunsUrl = `${repositoryUrl}/actions`;
  protected readonly runLink = linkToRun(handedOverBuildInfo());
}
