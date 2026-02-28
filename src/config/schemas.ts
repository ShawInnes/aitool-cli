import {z} from 'zod';

/** Schema for the remote config document fetched from the corp-provided URL */
export const RemoteConfigSchema = z.object({
	discoveryUrl: z.url(),
	clientId: z.string().min(1),
	scopes: z
		.array(z.string())
		.default(['openid', 'profile', 'email', 'offline_access']),
});

export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;

/** Schema for the OIDC discovery document */
export const OidcDiscoverySchema = z.object({
	issuer: z.url(),
	authorization_endpoint: z.url(),
	token_endpoint: z.url(),
	device_authorization_endpoint: z.url(),
	userinfo_endpoint: z.url().optional(),
});

export type OidcDiscovery = z.infer<typeof OidcDiscoverySchema>;

/** Schema for the locally stored config.json */
export const LocalConfigSchema = z.object({
	discoveryUrl: z.url(),
	clientId: z.string().min(1),
	scopes: z.array(z.string()),
	cachedDiscovery: OidcDiscoverySchema.optional(),
	discoveryFetchedAt: z.iso.datetime().optional(),
});

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

/** Schema for the device authorization response */
export const DeviceAuthResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.url(),
	verification_uri_complete: z.url().optional(),
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
	expiresAt: z.iso.datetime().optional(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
