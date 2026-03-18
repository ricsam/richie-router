import { Link, getRouteApi, linkOptions } from '@richie-router/react';
import { router } from '../demo/frontend/router';

const PostRouteApi = getRouteApi('/posts/$postId');
const SearchRouteApi = getRouteApi('/search');

void PostRouteApi;
void SearchRouteApi;
void router.navigate(linkOptions({ to: '/search', search: { query: 'router', limit: 2 } }));

const validPostLink = (
  <Link to="/posts/$postId" params={{ postId: 'alpha' }}>
    Open post
  </Link>
);

const validDashboardLink = (
  <Link to="/dashboard" search={{ auth: true }}>
    Open dashboard
  </Link>
);

void validPostLink;
void validDashboardLink;

// @ts-expect-error post detail routes require a postId param
const missingParam = <Link to="/posts/$postId">Broken</Link>;

// @ts-expect-error the post detail route only accepts postId
const wrongParam = <Link to="/posts/$postId" params={{ slug: 'alpha' }}>Broken</Link>;

// @ts-expect-error search.limit is typed as a number
const wrongSearchType = linkOptions({ to: '/search', search: { query: 'router', limit: '2' } });

void missingParam;
void wrongParam;
void wrongSearchType;
