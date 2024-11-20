import React, { useEffect, useRef } from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import ReactMarkdown from "react-markdown";
import { TranslationPair } from "../../../../types";
import "./SilverPathTab.css";

export interface SilverPathMessageBase {
    role: "user" | "assistant";
    content: string;
}

export interface UserMessage extends SilverPathMessageBase {
    role: "user";
}

export interface AssistantMessage extends SilverPathMessageBase {
    role: "assistant";
    thinking: string[];
    translation: string;
    memoriesUsed: string[];
    addMemory: string[];
}

export type SilverPathMessage = UserMessage | AssistantMessage;

interface SilverPathTabProps {
    chatHistory: SilverPathMessage[];
    chatInput: string;
    onChatInputChange: (input: string) => void;
    onChatSubmit: () => void;
    onChatFocus: () => void;
    onCopy: (content: string) => void;
    messageStyles: {
        user: React.CSSProperties;
        assistant: React.CSSProperties;
    };
    pinnedVerses: TranslationPair[];
    isLoading: boolean;
}

const defaultAssistantMessage: AssistantMessage = {
    role: "assistant",
    content: "Here's an example of how I'll respond to your query.",
    thinking: [
        "1. Analyze the verse and context",
        "2. Consider translation pairs",
        "3. Apply linguistic principles",
        "4. Draft initial translation",
        "5. Refine and finalize",
    ],
    translation: "This is where the translated verse or response will appear.",
    memoriesUsed: ["Example relevant information 1", "Example relevant information 2"],
    addMemory: ["New information or insight gained from this interaction"],
};

function SilverPathTab({
    chatHistory,
    chatInput,
    onChatInputChange,
    onChatSubmit,
    onChatFocus,
    onCopy,
    pinnedVerses,
    isLoading,
}: SilverPathTabProps) {
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const renderAssistantResponse = (message: AssistantMessage) => {
        return (
            <>
                <div className="silver-path-segment thinking-silver-path">
                    <h3>Thinking Process</h3>
                    <ul>
                        {message.thinking.map((thought, index) => (
                            <li key={index}>{thought}</li>
                        ))}
                    </ul>
                </div>

                <div className="silver-path-segment translation-silver-path">
                    <h3>Translation / Response</h3>
                    <div className="translation-content-silver-path silver-path-code">
                        <ReactMarkdown>{message.translation}</ReactMarkdown>
                    </div>
                    <div className="translation-actions-silver-path">
                        <VSCodeButton
                            appearance="icon"
                            onClick={() => onCopy(message.translation)}
                            title="Copy translation"
                        >
                            <span className="codicon codicon-copy"></span>
                        </VSCodeButton>
                        <VSCodeButton
                            appearance="icon"
                            onClick={() => {
                                /* TODO: Implement apply functionality */
                            }}
                            title="Apply translation"
                        >
                            <span className="codicon codicon-check"></span>
                        </VSCodeButton>
                    </div>
                </div>

                <div className="silver-path-segment memories-silver-path">
                    <h3>Relevant Information</h3>
                    {message.memoriesUsed.length > 0 ? (
                        <ul>
                            {message.memoriesUsed.map((memory, idx) => (
                                <li key={idx}>{memory}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No relevant information used for this response.</p>
                    )}
                </div>

                <div className="silver-path-segment new-memory-silver-path">
                    <h3>New Information</h3>
                    {message.addMemory.length > 0 ? (
                        <ul>
                            {message.addMemory.map((memory, idx) => (
                                <li key={idx}>{memory}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No new information to add at this time.</p>
                    )}
                </div>
            </>
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            onChatSubmit();
        }
    };

    return (
        <div className="silver-path-container">
            <div ref={chatHistoryRef} className="silver-path-history">
                {chatHistory.length === 0 ? (
                    <div className="silver-path-message assistant">
                        {renderAssistantResponse(defaultAssistantMessage)}
                    </div>
                ) : (
                    <>
                        <div className="silver-path-message user">
                            <ReactMarkdown>
                                {chatHistory[chatHistory.length - 1].content}
                            </ReactMarkdown>
                        </div>
                        <div className="silver-path-message assistant">
                            {renderAssistantResponse(
                                (chatHistory[chatHistory.length - 1] as AssistantMessage).role ===
                                    "assistant"
                                    ? (chatHistory[chatHistory.length - 1] as AssistantMessage)
                                    : defaultAssistantMessage
                            )}
                        </div>
                    </>
                )}
                {isLoading && (
                    <div className="silver-path-loading">
                        <div className="silver-path-loading-spinner"></div>
                        <span>Thinking...</span>
                    </div>
                )}
            </div>
            <div className="silver-path-input-container">
                <div className="silver-path-input-wrapper">
                    <textarea
                        className="silver-path-textarea"
                        value={chatInput}
                        onChange={(e) => onChatInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={onChatFocus}
                        placeholder="Ask about these passages... (Ctrl + Enter to send)"
                    />
                    <VSCodeButton
                        onClick={onChatSubmit}
                        className="silver-path-send-button"
                        appearance="icon"
                        title="Send"
                    >
                        <span className="codicon codicon-send" />
                    </VSCodeButton>
                </div>
            </div>
        </div>
    );
}

export default React.memo(SilverPathTab);
