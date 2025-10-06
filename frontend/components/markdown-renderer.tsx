"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Headings with beautiful styling - BIG, BOLD, VISIBLE
          h1: ({ children }) => (
            <h1 className="text-4xl font-bold text-foreground mb-6 mt-8 pb-4 border-b-2 border-white/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-3 rounded-lg shadow-lg">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-3xl font-bold text-foreground mb-5 mt-7 pb-3 border-b border-white/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5 px-3 py-2 rounded">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-2xl font-semibold text-foreground mb-4 mt-6 pb-2 border-b border-white/10">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xl font-semibold text-foreground mb-3 mt-5 text-blue-300">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-lg font-semibold text-foreground mb-2 mt-4 text-blue-200">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-base font-semibold text-foreground/90 mb-2 mt-3 text-blue-100">
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-foreground/90 leading-relaxed mb-4 text-base">
              {children}
            </p>
          ),

          // Code blocks with syntax highlighting
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const code = String(children).replace(/\n$/, '');
            const isInline = !className?.includes('language-');

            if (!isInline && language) {
              return (
                <div className="relative my-6">
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
                    <span className="text-xs text-gray-400 font-mono uppercase tracking-wide">{language}</span>
                    <button
                      onClick={() => copyToClipboard(code)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                    >
                      {copiedCode === code ? (
                        <>
                          <CheckIcon className="h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark as any}
                    language={language}
                    PreTag="div"
                    className="!mt-0 !rounded-t-none !rounded-b-lg"
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm font-mono border border-blue-500/30" {...props}>
                {children}
              </code>
            );
          },

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-foreground/90 mb-4 space-y-2 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-foreground/90 mb-4 space-y-2 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-6 py-4 my-6 bg-gradient-to-r from-blue-500/10 to-transparent rounded-r-lg shadow-lg">
              <div className="text-foreground/90 italic text-lg">
                {children}
              </div>
            </blockquote>
          ),

          // Tables (GitHub Flavored Markdown)
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 shadow-lg">
              <table className="min-w-full border-collapse border border-white/20 rounded-lg bg-white/5">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-blue-500/20 to-purple-500/20">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-white/10">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/5 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-6 py-4 text-left text-foreground font-bold border-r border-white/10 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 text-foreground/90 border-r border-white/10 last:border-r-0">
              {children}
            </td>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline transition-colors hover:bg-blue-500/10 px-1 py-0.5 rounded"
            >
              {children}
            </a>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="border-white/20 my-8 border-t-2" />
          ),

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">
              {children}
            </strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-foreground/95">
              {children}
            </em>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-foreground/60">
              {children}
            </del>
          ),

          // Task lists (GitHub Flavored Markdown)
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-3 accent-blue-500 scale-110"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },

          // Strikethrough (GitHub Flavored Markdown)
          s: ({ children }) => (
            <s className="line-through text-foreground/60">
              {children}
            </s>
          ),

          // Pre blocks
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
