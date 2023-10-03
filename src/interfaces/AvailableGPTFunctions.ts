export interface AvailableGPTFunctions {
	get_web_search: (query: string) => Promise<string>;
	// ...other function signatures
}