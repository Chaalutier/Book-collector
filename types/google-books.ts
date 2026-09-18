export type GoogleBook = {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: {
      thumbnail?: string;
    };
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    publisher?: string;
  };
};