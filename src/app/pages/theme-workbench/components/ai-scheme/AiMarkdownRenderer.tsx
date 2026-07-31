import type {
  AnchorHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownCompatibilityProps {
  children: string;
  remarkPlugins: unknown[];
  components: unknown;
}

interface ChildrenProps {
  children?: ReactNode;
}

type CodeProps = ChildrenProps & HTMLAttributes<HTMLElement>;
type LinkProps = ChildrenProps & AnchorHTMLAttributes<HTMLAnchorElement>;

// react-markdown currently resolves against React 19 component types while the
// app is still on React 18. Keep that package boundary isolated in this chunk.
const Markdown = ReactMarkdown as unknown as ComponentType<MarkdownCompatibilityProps>;

const markdownComponents = {
  p: ({ children }: ChildrenProps) => <p className="mb-1 last:mb-0">{children}</p>,
  code: ({ className, children, ...props }: CodeProps) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return (
        <pre className="mb-1 mt-1 overflow-x-auto rounded-lg bg-slate-100 p-2 text-2xs leading-5">
          <code className={className} {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-2xs" {...props}>
        {children}
      </code>
    );
  },
  ul: ({ children }: ChildrenProps) => <ul className="mb-1 list-disc pl-4">{children}</ul>,
  ol: ({ children }: ChildrenProps) => <ol className="mb-1 list-decimal pl-4">{children}</ol>,
  li: ({ children }: ChildrenProps) => <li className="text-xs leading-5">{children}</li>,
  strong: ({ children }: ChildrenProps) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }: LinkProps) => (
    <a
      href={href}
      className="underline underline-offset-2 hover:text-slate-900"
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!href || !window.cursorDanceApp) return;
        event.preventDefault();
        void window.cursorDanceApp.openExternal(href);
      }}
    >
      {children}
    </a>
  ),
};

export function AiMarkdownRenderer({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {children}
    </Markdown>
  );
}
