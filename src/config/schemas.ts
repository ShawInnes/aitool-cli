import {z} from 'zod';

/** Schema for the remote config document fetched from the corp-provided URL */
export const RemoteConfigSchema = z.object({
	discoveryUrl: z.string().url(),
	clientId: z.string().min(1),
	scopes: z
		.array(z.string())
		.default(['openid', 'profile', 'email', 'offline_access']),
});

export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;

/** Schema for the OIDC discovery document */
export const OidcDiscoverySchema = z.object({
	issuer: z.string().url(),
	authorization_endpoint: z.string().url(),
	token_endpoint: z.string().url(),
	device_authorization_endpoint: z.string().url(),
	userinfo_endpoint: z.string().url().optional(),
});

export type OidcDiscovery = z.infer<typeof OidcDiscoverySchema>;

/** Schema for the locally stored config.json */
export const LocalConfigSchema = z.object({
	discoveryUrl: z.string().url(),
	clientId: z.string().min(1),
	scopes: z.array(z.string()),
	cachedDiscovery: OidcDiscoverySchema.optional(),
	discoveryFetchedAt: z.string().datetime().optional(),
});

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

/** Schema for the device authorization response */
export const DeviceAuthResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.string().url(),
	verification_uri_complete: z.string().url().optional(),
	expires_in: z.number(),
	interval: z.number().default(5),
});

export type DeviceAuthResponse = z.infer<typeof DeviceAuthResponseSchema>;

/** Schema for the token endpoint response */
export const TokenResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.string(),
	expires_in: z.number().optional(),
	refresh_token: z.string().optional(),
	scope: z.string().optional(),
	id_token: z.string().optional(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

/** Schema for locally stored credentials.json */
export const CredentialsSchema = z.object({
	accessToken: z.string(),
	tokenType: z.string(),
	refreshToken: z.string().optional(),
	idToken: z.string().optional(),
	scope: z.string().optional(),
	expiresAt: z.string().datetime().optional(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
