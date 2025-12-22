import { ExternalLink, FileText, BookMarked } from 'lucide-react';
import { Citation } from '@/types/chat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CitationsPanelProps {
  citations: Citation[];
}

export function CitationsPanel({ citations }: CitationsPanelProps) {
  if (citations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-citation-bg flex items-center justify-center mb-3">
          <BookMarked className="h-6 w-6 text-muted-foreground" />
        </div>
        <h4 className="font-medium text-foreground mb-1">No Citations</h4>
        <p className="text-sm text-muted-foreground">
          Citations from the PDF sources will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-serif font-semibold text-foreground flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" />
          PDF Sources ({citations.length})
        </h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {citations.map((citation, index) => (
            <div
              key={index}
              className={cn(
                'p-3 rounded-lg border border-citation-border bg-citation-bg',
                'hover:border-primary/30 transition-colors animate-fade-in'
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <h4 className="font-medium text-sm text-foreground line-clamp-2">
                  {citation.title || 'PDF Document'}
                </h4>
              </div>
              
              {/* Show retrieved_context.text as a card snippet */}
              {citation.text && (
                <div className="pl-6 mb-2">
                  <div className="p-2 rounded bg-muted/50 border-l-2 border-primary/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      "{citation.text}"
                    </p>
                  </div>
                </div>
              )}
              
              {citation.uri && (
                <a
                  href={citation.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline pl-6"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open source
                </a>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}