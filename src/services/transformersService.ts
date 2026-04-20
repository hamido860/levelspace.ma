import { pipeline } from '@xenova/transformers';

class TransformersService {
  private summarizer: any = null;
  private isLoading = false;

  async init() {
    if (this.summarizer || this.isLoading) return;
    this.isLoading = true;
    try {
      // Using a small model for local summarization
      this.summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    } catch (error) {
      console.error('Failed to load transformers model:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async summarize(text: string): Promise<string> {
    if (!this.summarizer) {
      await this.init();
    }
    
    if (!this.summarizer) {
      return "Local AI model failed to load. Please check your connection or try again later.";
    }

    try {
      const result = await this.summarizer(text, {
        max_new_tokens: 100,
        min_new_tokens: 20,
        do_sample: false,
      });
      return result[0].summary_text;
    } catch (error) {
      console.error('Local summarization failed:', error);
      return "Local summarization failed.";
    }
  }
}

export const transformersService = new TransformersService();
