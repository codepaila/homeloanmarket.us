'use client'

// components/editor/RichTextEditor.tsx
//
// Reusable Tiptap 3 rich-text editor. Contains ZERO BlogPost/business logic:
// the parent owns persistence, validation, submission, authorization and
// publishing; this component owns editing, formatting, the toolbar and HTML
// serialization. Styling uses the app's semantic CSS variables (see
// `.rich-text-toolbar` / `.rich-text-content` in app/globals.css).

import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold,
  Code,
  CodeSquare,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react'

export type RichTextEditorProps = {
  /** Current document. Editor HTML, or legacy plain text (loaded as-is). */
  value: string
  /** Emits serialized HTML on every document update. */
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  editorClassName?: string
}

/** Dangerous URL schemes are never inserted by the editor. Pure + shared with tests. */
export function isSafeLinkUrl(rawUrl: string): boolean {
  const url = rawUrl.trim()
  if (!url) return false
  const normalized = url.replace(/[\s\u0000-\u001f\u007f]/g, '').toLowerCase()
  // Kill-switch characters that defeat naive scheme parsing.
  if (/[\u0000-\u001f]/.test(rawUrl)) return false
  if (/^(javascript|vbscript|data):/i.test(normalized)) return false
  // Allow http(s), mailto, relative and anchor URLs.
  if (/^(https?:|mailto:)/i.test(normalized)) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(normalized) // any other scheme → reject
}

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(event) => {
        // Prevent focus leaving the editor so commands apply to the selection.
        event.preventDefault()
      }}
      onClick={onClick}
      className="rich-text-toolbar-button"
      data-active={active ? 'true' : undefined}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      isBold: current.isActive('bold'),
      isItalic: current.isActive('italic'),
      isUnderline: current.isActive('underline'),
      isStrike: current.isActive('strike'),
      isCode: current.isActive('code'),
      isCodeBlock: current.isActive('codeBlock'),
      isH1: current.isActive('heading', { level: 1 }),
      isH2: current.isActive('heading', { level: 2 }),
      isH3: current.isActive('heading', { level: 3 }),
      isH4: current.isActive('heading', { level: 4 }),
      isH5: current.isActive('heading', { level: 5 }),
      isBulletList: current.isActive('bulletList'),
      isOrderedList: current.isActive('orderedList'),
      isBlockquote: current.isActive('blockquote'),
      isLink: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  })

  const run = (fn: () => void) => () => fn()

  return (
    <div role="toolbar" aria-label="Formatting" className="rich-text-toolbar">
      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={run(() => editor.chain().focus().undo().run())}>
        <Undo2 aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={run(() => editor.chain().focus().redo().run())}>
        <Redo2 aria-hidden="true" size={15} />
      </ToolbarButton>

      <span className="rich-text-toolbar-separator" role="separator" aria-orientation="vertical" />

      <ToolbarButton label="Paragraph" active={!state.isH1 && !state.isH2 && !state.isH3} onClick={run(() => editor.chain().focus().setParagraph().run())}>
        <TypeGlyph aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Heading 1" active={state.isH1} onClick={run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>
        <Heading1 aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={state.isH2} onClick={run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>
        <Heading2 aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={state.isH3} onClick={run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>
        <Heading3 aria-hidden="true" size={15} />
      </ToolbarButton>

      <span className="rich-text-toolbar-separator" role="separator" aria-orientation="vertical" />

      <ToolbarButton label="Bold" active={state.isBold} onClick={run(() => editor.chain().focus().toggleBold().run())}>
        <Bold aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.isItalic} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
        <Italic aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={state.isUnderline} onClick={run(() => editor.chain().focus().toggleUnderline().run())}>
        <Underline aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={state.isStrike} onClick={run(() => editor.chain().focus().toggleStrike().run())}>
        <StrikeGlyph aria-hidden="true" size={15} />
      </ToolbarButton>

      <span className="rich-text-toolbar-separator" role="separator" aria-orientation="vertical" />

      <ToolbarButton label="Bullet list" active={state.isBulletList} onClick={run(() => editor.chain().focus().toggleBulletList().run())}>
        <List aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.isOrderedList} onClick={run(() => editor.chain().focus().toggleOrderedList().run())}>
        <ListOrdered aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Blockquote" active={state.isBlockquote} onClick={run(() => editor.chain().focus().toggleBlockquote().run())}>
        <Quote aria-hidden="true" size={15} />
      </ToolbarButton>

      <span className="rich-text-toolbar-separator" role="separator" aria-orientation="vertical" />

      <ToolbarButton label="Link" active={state.isLink} onClick={run(() => handleLink(editor))}>
        <Link2 aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Inline code" active={state.isCode} onClick={run(() => editor.chain().focus().toggleCode().run())}>
        <Code aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={state.isCodeBlock} onClick={run(() => editor.chain().focus().toggleCodeBlock().run())}>
        <CodeSquare aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton label="Horizontal rule" onClick={run(() => editor.chain().focus().setHorizontalRule().run())}>
        <Minus aria-hidden="true" size={15} />
      </ToolbarButton>
    </div>
  )
}

function handleLink(editor: Editor) {
  const existing = (editor.getAttributes('link').href as string | undefined) || ''
  const input = existing
    ? window.prompt('Link URL (leave empty to remove):', existing)
    : window.prompt('Link URL:', 'https://')
  if (input === null) return // cancelled
  const url = input.trim()
  if (!url) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  if (!isSafeLinkUrl(url)) {
    window.alert('That URL scheme is not allowed. Use http(s), mailto, or a relative link.')
    return
  }
  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' })
    .run()
}

// Minimal inline glyphs (no extra icon deps): paragraph toggle + strikethrough.
function TypeGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

function StrikeGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your article...',
  disabled = false,
  className,
  editorClassName,
}: RichTextEditorProps) {
  // Latest props for event callbacks, kept current in an effect (never during
  // render, per React Compiler lint rules).
  const latest = useRef({ value, onChange, disabled })
  useEffect(() => {
    latest.current = { value, onChange, disabled }
  }, [value, onChange, disabled])

  const editor = useEditor({
    immediatelyRender: false, // SSR-safe (Next.js): no browser APIs during server render
    // `content` and `editable` are consumed at editor creation only; later
    // value/disabled changes flow through the sync effects below.
    content: value || '',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
        // Optional-but-free StarterKit members this phase includes.
        code: {},
        codeBlock: {},
        horizontalRule: {},
        // Everything not in the required/optional set stays enabled by
        // StarterKit default (paragraph, bold, italic, underline, strike,
        // lists, blockquote, undo/redo, hard break).
      }),
      Placeholder.configure({ placeholder }),
    ],
    editable: !disabled,
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? '' : current.getHTML()
      latest.current.onChange(html)
    },
  })

  // Disabled is a live prop.
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // External value changes (e.g. edit-mode load arriving after mount) are
  // applied when they differ from the editor's own serialization. Loop-safe:
  // the guard makes the sync a no-op for editor-originated updates.
  const lastEmittedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.isEmpty ? '' : editor.getHTML()
    if (value === currentHtml || value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  return (
    <div
      className={className ? `rich-text ${className}` : 'rich-text'}
      data-disabled={disabled ? 'true' : undefined}
    >
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent
        editor={editor}
        className={editorClassName ? `rich-text-content ${editorClassName}` : 'rich-text-content'}
      />
    </div>
  )
}
