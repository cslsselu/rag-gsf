export interface Citation {
  title: string;
  uri: string;
  text?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}