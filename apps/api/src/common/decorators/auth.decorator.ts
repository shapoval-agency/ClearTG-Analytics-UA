import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRES_WORKSPACE_KEY = 'requiresWorkspace';
export const RequiresWorkspace = () => SetMetadata(REQUIRES_WORKSPACE_KEY, true);
