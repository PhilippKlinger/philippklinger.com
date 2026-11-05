import { ActivatedRouteSnapshot, CanMatchFn, ResolveFn } from '@angular/router';
import { Project, projects } from '../../../content/projects';

/** Projects with a page of their own; the prerender params come from this list too. */
export const projectPages = projects.filter((project) => project.hasPage);

function findProjectPage(slug: string | null | undefined): Project | undefined {
  return projectPages.find((project) => project.slug === slug);
}

// Canceled match falls through to the "**" route, so an unknown slug shows the 404 page.
export const hasProjectPage: CanMatchFn = (_route, segments) =>
  findProjectPage(segments[1]?.path) !== undefined;

// hasProjectPage has already matched, so the lookup cannot miss here.
function routeProject(route: ActivatedRouteSnapshot): Project {
  return findProjectPage(route.paramMap.get('slug'))!;
}

export const projectResolver: ResolveFn<Project> = (route) => routeProject(route);

export const projectTitle: ResolveFn<string> = (route) =>
  `${routeProject(route).title} – Philipp Klinger`;

export const projectDescription: ResolveFn<string> = (route) => routeProject(route).description;
