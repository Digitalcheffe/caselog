import { useCallback, useEffect, useMemo, useState } from 'react';

const matchPath = (pathname: string, routePath: string): Record<string, string> | null => {
  const pathParts = pathname.split('/').filter(Boolean);
  const routeParts = routePath.split('/').filter(Boolean);

  if (pathParts.length !== routeParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];

    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
};

export const useRouter = (routes: string[]) => {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
      setPathname(path);
    }
  }, []);

  return useMemo(() => {
    const matched = routes
      .map((route) => ({ route, params: matchPath(pathname, route) }))
      .find((item) => item.params !== null);

    return {
      pathname,
      currentRoute: matched?.route ?? '*',
      params: matched?.params ?? {},
      navigate
    };
  }, [navigate, pathname, routes]);
};
