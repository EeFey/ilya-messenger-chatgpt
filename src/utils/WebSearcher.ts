import google from 'googlethis';

export class WebSearcher {
  private options: object;

  constructor() {
    this.options = {
      page: 0,
      safe: false, // Safe Search
      parse_ads: false, // If set to true sponsored results will be parsed
      additional_params: { 
        hl: 'en' // Set the language of the search to English
      }
    };
  }

  getWebSearch = async (query: string): Promise<string> => {
    const response = await google.search(query, this.options);
    let result = "";

    if (response.featured_snippet && response.featured_snippet.description) {
      result = response.featured_snippet.description;
    } 
    else if (response.results && response.results.length) {
      const results = response.results.slice(0,2).map(result => result.title + " - " + result.description );
      result = JSON.stringify(results);
    }

    console.log("Web Search Result: ", result);
    return result;
  }
}