import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const AUTH_RETRIED = new HttpContextToken(() => false);

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const skipBearer = req.url.includes('/auth/refresh') || req.url.includes('/auth/logout');
  const token = auth.token();
  const authorized =
    token && !skipBearer ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthEndpoint(req.url) || req.context.get(AUTH_RETRIED)) {
        return throwError(() => error);
      }
      if (!auth.refreshToken()) {
        auth.logout();
        return throwError(() => error);
      }
      return from(auth.refreshSession()).pipe(
        switchMap(() => {
          const nextToken = auth.token();
          return next(
            req.clone({
              setHeaders: nextToken ? { Authorization: `Bearer ${nextToken}` } : {},
              context: req.context.set(AUTH_RETRIED, true)
            })
          );
        }),
        catchError((refreshError) => throwError(() => refreshError))
      );
    })
  );
};
