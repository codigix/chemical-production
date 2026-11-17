import { useEffect, useState } from 'react';

/* Tiny hash router (no extra dependency). Routes look like #/production/orders?order=PRD-1001 */
const parse = () => {
  const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, qs = ''] = raw.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs)) };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (path, params) => {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  window.location.hash = `/${path}${qs}`;
};
