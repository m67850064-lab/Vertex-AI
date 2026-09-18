import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTextToServer, sendToBackend } from '@/lib/chatApi';
import type { ChatAttachment } from '@/lib/fileUpload';
import {
  getImageGenerationPrompt,
  getInstantPdfContent,
  getPdfGenerationPrompt,
} from '@/lib/contentRequests';
import { generateAndSharePdf } from '@/lib/nativeContent';

const STORAGE_KEY = 'vertex-ai-conversations';

const SYSTEM_PROMPT =
  'You are Vertex AI, a friendly and helpful conversational assistant. ' +
  'Reply directly and naturally in the same language the user speaks — ' +
  'whether that is English, Hindi, Roman Urdu, or any other language. ' +
  'Be concise, clear, and conversational. Do not echo or repeat the user\'s ' +
  'question back. Just answer helpfully. When a file is shared, describe or ' +
  'answer based on what you see in it.';

export const SAMPLE_PROMPTS = [
  'Explain quantum computing in simple terms',
  'Write a poem about the ocean',
  'Give me ideas for a weekend project',
  'What are the latest AI trends?',
];

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  attachment?: ChatAttachment;
  imagePrompt?: string;
  pdfPrompt?: string;
  pdfStatus?: 'generating' | 'ready' | 'error';
  pdfError?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ConversationContextType {
  conversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
  drawerOpen: boolean;
  isLoading: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  handleNewChat: () => void;
  handleSelectChat: (id: string) => void;
  handleDeleteChat: (id: string) => void;
  handleRenameChat: (id: string, title: string) => void;
  handleSendMessage: (text: string, attachment?: ChatAttachment) => void;
  stopGeneration: () => void;
  clearAllHistory: () => void;
}

const ConversationContext = createContext<ConversationContextType | null>(null);

export function useConversations(): ConversationContextType {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversations must be used within ConversationProvider');
  return ctx;
}

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  // Tracks the current generation; cleared by stopGeneration() to cancel it
  const generationIdRef = useRef<string | null>(null);

  // Load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mountedRef.current) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setConversations(parsed);
              setActiveId(parsed[0].id);
            }
          } catch {
            // ignore
          }
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (mountedRef.current) setIsLoading(false);
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Persist to storage whenever conversations change
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)).catch(() => {});
    }
  }, [conversations, isLoading]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleNewChat = useCallback(() => {
    const conv: Conversation = {
      id: uid(),
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setDrawerOpen(false);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      setActiveId((current) => {
        if (current === id) {
          return filtered.length > 0 ? filtered[0].id : null;
        }
        return current;
      });
      return filtered;
    });
  }, []);

  const handleRenameChat = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
  }, []);

  // Stop the currently running generation
  const stopGeneration = useCallback(() => {
    generationIdRef.current = null; // invalidate ongoing generation
    // Remove the empty typing bubble immediately
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.filter((m) => !(m.role === 'model' && m.text === '')),
      }))
    );
  }, []);

  const handleSendMessage = useCallback(
    async (text: string, attachment?: ChatAttachment) => {
      if (!text.trim() && !attachment) return;

      const trimmedText = text.trim();
      const imagePrompt = getImageGenerationPrompt(trimmedText);
      const pdfPrompt = imagePrompt ? null : getPdfGenerationPrompt(trimmedText);
      const instantPdfContent = pdfPrompt ? getInstantPdfContent(trimmedText) : null;
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: trimmedText,
        timestamp: Date.now(),
        attachment,
      };
      const modelMsg: ChatMessage = {
        id: uid(),
        role: 'model',
        text: '',
        timestamp: Date.now(),
        imagePrompt: imagePrompt ?? undefined,
        pdfPrompt: pdfPrompt ?? undefined,
        pdfStatus: pdfPrompt ? 'generating' : undefined,
      };
      const modelMsgId = modelMsg.id;

      // Assign a generation ID so stopGeneration() can cancel it
      const genId = uid();
      generationIdRef.current = genId;

      const currentConv = activeConversation;
      const currentActiveId = activeId;
      if (!currentConv || !currentActiveId) {
        const newConvId = uid();
        const newConv: Conversation = {
          id: newConvId,
          title: trimmedText.slice(0, 40) || attachment?.name || 'New chat',
          messages: [userMsg, modelMsg],
          createdAt: Date.now(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(newConvId);
      } else {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== currentActiveId) return c;
            const title =
              c.messages.length === 0
                ? trimmedText.slice(0, 40) || attachment?.name || 'New chat'
                : c.title;
            return { ...c, title, messages: [...c.messages, userMsg, modelMsg] };
          })
        );
      }

      try {
        if (imagePrompt) {
          // Image requests are rendered directly from Pollinations in the chat.
          // Do not send them to a text model that could return a fake image URL.
          return;
        }

        const history = (currentConv?.messages ?? [])
          .filter((m) => m.text && m.role !== 'model' || m.text)
          .slice(-10)
          .map((m) => ({
            role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text,
          }));

        if (pdfPrompt) {
          try {
            const result =
              instantPdfContent !== null
                ? { text: instantPdfContent }
                : await sendTextToServer({ prompt: pdfPrompt, history });
            await generateAndSharePdf(
              'Vertex AI document',
              result.text,
            );

            if (!mountedRef.current || generationIdRef.current !== genId) return;
            setConversations((prev) =>
              prev.map((c) => ({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === modelMsgId
                    ? { ...m, text: result.text, pdfStatus: 'ready' }
                    : m,
                ),
              })),
            );
          } catch (error) {
            if (!mountedRef.current || generationIdRef.current !== genId) return;
            const message =
              error instanceof Error ? error.message : 'Could not create the PDF.';
            setConversations((prev) =>
              prev.map((c) => ({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === modelMsgId
                    ? { ...m, pdfStatus: 'error', pdfError: message }
                    : m,
                ),
              })),
            );
          }
          return;
        }

        let result: { text: string; provider?: string };
        if (attachment) {
          result = await sendToBackend({ text: trimmedText, attachment });
        } else {
          // Route text through server — server has fast internet, device only
          // needs one connection to Replit instead of 4 direct AI API calls.
          result = await sendTextToServer({ prompt: trimmedText, history });
        }

        if (!mountedRef.current) return;
        // If generation was cancelled, the empty bubble is already removed — do nothing
        if (generationIdRef.current !== genId) return;

        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === modelMsgId ? { ...m, text: result.text } : m
            ),
          }))
        );
      } catch (err) {
        if (!mountedRef.current) return;
        if (generationIdRef.current !== genId) return;
        const errMsg =
          err instanceof Error
            ? err.message
            : "Sorry, I couldn't process your request. Please try again.";
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === modelMsgId ? { ...m, text: errMsg } : m
            ),
          }))
        );
      }
    },
    [activeConversation, activeId]
  );

  const clearAllHistory = useCallback(() => {
    setConversations([]);
    setActiveId(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeId,
        activeConversation,
        drawerOpen,
        isLoading,
        openDrawer,
        closeDrawer,
        handleNewChat,
        handleSelectChat,
        handleDeleteChat,
        handleRenameChat,
        handleSendMessage,
        stopGeneration,
        clearAllHistory,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}
