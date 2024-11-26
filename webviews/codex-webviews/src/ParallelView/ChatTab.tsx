import React, { useEffect, useRef, useCallback, useState } from "react";
import {
    VSCodeButton,
    VSCodeTextField,
    VSCodeBadge,
    VSCodeDivider,
} from "@vscode/webview-ui-toolkit/react";
import ChatInput from "./ChatInput";
import { ChatMessage } from "./types";
import { TranslationPair } from "../../../../types";
import "./SharedStyles.css";
import {
    onCopy,
    RegEx,
    IndividuallyTranslatedVerseComponent,
    ShowUserPreferenceComponent,
    AddedFeedbackComponent,
    GuessNextPromptsComponent,
    YoutubeVideoComponent,
} from "./ChatComponents";
import { format } from "date-fns";

interface SessionInfo {
    id: string;
    name: string;
    timestamp: string;
}

interface ChatTabProps {
    chatHistory: ChatMessage[];
    chatInput: string;
    onChatInputChange: (input: string) => void;
    onChatSubmit: () => void;
    onChatFocus: () => void;
    onEditMessage: (index: number) => void;
    messageStyles: {
        user: React.CSSProperties;
        assistant: React.CSSProperties;
    };
    pinnedVerses: TranslationPair[];
    onApplyTranslation: (cellId: string, text: string) => void;
    handleAddedFeedback: (cellId: string, feedback: string) => void;
    sessionInfo: SessionInfo | null;
    allSessions: SessionInfo[];
    onStartNewSession: () => void;
    onLoadSession: (sessionId: string) => void;
}

function ChatTab({
    chatHistory,
    chatInput,
    onChatInputChange,
    onChatSubmit,
    onChatFocus,
    onEditMessage,
    pinnedVerses,
    onApplyTranslation,
    handleAddedFeedback,
    sessionInfo,
    allSessions,
    onStartNewSession,
    onLoadSession,
}: ChatTabProps) {
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [currentMessage, setCurrentMessage] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredSessions, setFilteredSessions] = useState(allSessions);
    const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    useEffect(() => {
        const filtered = allSessions
            .filter((session) => session.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setFilteredSessions(filtered);
    }, [searchTerm, allSessions]);

    const handleRedoMessage = useCallback(
        (index: number, content: string) => {
            onEditMessage(index);
            onChatInputChange(content);
            setPendingSubmit(true);
        },
        [onEditMessage, onChatInputChange]
    );

    useEffect(() => {
        if (pendingSubmit) {
            onChatSubmit();
            setPendingSubmit(false);
        }
    }, [pendingSubmit, onChatSubmit]);

    const handleIncomingChunk = useCallback((message: any) => {
        if (message.command === "chatResponseStream") {
            try {
                const parsedChunk = JSON.parse(message.data);
                const { content, isLast } = parsedChunk;

                if (content) {
                    setCurrentMessage((prevMessage) => prevMessage + content);
                    setIsStreaming(true);
                }
            } catch (error) {
                console.error("Error parsing chunk data:", error);
            }
        } else if (message.command === "chatResponseComplete") {
            setIsStreaming(false);
        }
    }, []);

    const handlePromptClick = useCallback(
        (prompt: string) => {
            onChatInputChange(prompt);
            onChatSubmit();
        },
        [onChatInputChange, onChatSubmit]
    );

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.command === "chatResponseStream") {
                handleIncomingChunk(event.data.data);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleIncomingChunk]);

    const parseMessage = (content: string) => {
        const parts = [];
        let lastIndex = 0;

        // Get all component regex patterns from RegEx
        const regexPatterns = Object.entries(RegEx);

        for (let i = 0; i < content.length; ) {
            let earliestMatch: {
                regex: RegExp;
                match: RegExpExecArray;
                type: string;
            } | null = null;

            // Find the earliest matching component
            for (const [type, regex] of regexPatterns) {
                regex.lastIndex = i;
                const match = regex.exec(content);
                if (match && (!earliestMatch || match.index < earliestMatch.match.index)) {
                    earliestMatch = {
                        regex,
                        match,
                        type,
                    };
                }
            }

            if (earliestMatch) {
                // Add text content before the component if any
                if (earliestMatch.match.index > lastIndex) {
                    parts.push({
                        type: "text",
                        content: content.slice(lastIndex, earliestMatch.match.index),
                    });
                }

                // Parse the component props
                const propsString = earliestMatch.match[1];
                const propsMatch = propsString.match(/(\w+)="([^"]*)"/g);

                if (propsMatch) {
                    const props = Object.fromEntries(
                        propsMatch.map((prop) => {
                            const [key, value] = prop.split("=");
                            return [key, value.replace(/(^")|("$)/g, "")];
                        })
                    );
                    parts.push({ type: earliestMatch.type, props });
                }

                lastIndex = earliestMatch.regex.lastIndex;
                i = lastIndex;
            } else {
                // No more components found, add remaining text
                parts.push({
                    type: "text",
                    content: content.slice(lastIndex),
                });
                break;
            }
        }

        return parts;
    };

    const renderMessage = useCallback((content: string) => {
        const parsedContent = parseMessage(content);

        return (
            <>
                {parsedContent.map((part, index) => {
                    if (part.type === "text") {
                        return (
                            <p
                                key={index}
                                dangerouslySetInnerHTML={{ __html: part.content || "" }}
                            />
                        );
                    } else if (part.type === "IndividuallyTranslatedVerse" && part.props) {
                        return (
                            <IndividuallyTranslatedVerseComponent
                                key={`tr-${index}`}
                                text={part.props.text || ""}
                                cellId={part.props.cellId}
                                onApplyTranslation={onApplyTranslation}
                            />
                        );
                    } else if (part.type === "AddedFeedback" && part.props) {
                        return (
                            <AddedFeedbackComponent
                                key={`af-${index}`}
                                feedback={part.props.feedback}
                                cellId={part.props.cellId}
                                handleAddedFeedback={(cellId, feedback) =>
                                    handleAddedFeedback(cellId, feedback)
                                }
                            />
                        );
                    } else if (part.type === "ShowUserPreference" && part.props) {
                        return (
                            <ShowUserPreferenceComponent
                                key={`sf-${index}`}
                                feedback={part.props.feedback}
                                cellId={part.props.cellId}
                            />
                        );
                    } else if (part.type === "GuessNextPrompts" && part.props) {
                        return (
                            <GuessNextPromptsComponent
                                key={`gp-${index}`}
                                prompts={part.props.prompts.split(",")}
                                onClick={(prompt) => handlePromptClick(prompt)}
                            />
                        );
                    } else if (part.type === "YoutubeVideo" && part.props) {
                        return (
                            <YoutubeVideoComponent
                                key={`yv-${index}`}
                                videoId={part.props.videoId}
                            />
                        );
                    }
                    return null;
                })}
            </>
        );
    }, []);

    return (
        <div className="tab-container">
            <div className="session-management">
                <VSCodeTextField
                    placeholder="Search or create a session..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                >
                    <span slot="start" className="codicon codicon-search"></span>
                </VSCodeTextField>
                <VSCodeButton
                    appearance="icon"
                    onClick={() => setIsSessionMenuOpen(!isSessionMenuOpen)}
                    title="Session list"
                >
                    <span className="codicon codicon-list-flat"></span>
                </VSCodeButton>
                <VSCodeButton onClick={onStartNewSession}>
                    <span className="codicon codicon-add"></span>
                </VSCodeButton>
            </div>

            {isSessionMenuOpen && (
                <div className="session-menu">
                    <div className="session-list">
                        {filteredSessions.map((session) => (
                            <div
                                key={session.id}
                                className={`session-item ${
                                    sessionInfo?.id === session.id ? "active" : ""
                                }`}
                                onClick={() => onLoadSession(session.id)}
                            >
                                <span>{session.name}</span>
                                <span>{format(new Date(session.timestamp), "PP")}</span>
                            </div>
                        ))}
                    </div>
                    <VSCodeDivider />
                    <div className="pinned-verses-section">
                        <h4>Pinned Verses</h4>
                        {pinnedVerses.length > 0 ? (
                            <div className="pinned-verses-list">
                                {pinnedVerses.map((verse) => (
                                    <VSCodeBadge key={verse.cellId}>{verse.cellId}</VSCodeBadge>
                                ))}
                            </div>
                        ) : (
                            <p className="no-pinned-verses">No pinned verses</p>
                        )}
                    </div>
                </div>
            )}

            <div ref={chatHistoryRef} className="message-history">
                {chatHistory.length > 1 ? (
                    <div className="chat-messages">
                        {chatHistory.slice(1).map((message, index) => (
                            <div key={index} className={`chat-message ${message.role}`}>
                                {renderMessage(message.content)}
                                <div className="chat-message-actions">
                                    {message.role === "user" && (
                                        <>
                                            <VSCodeButton
                                                appearance="icon"
                                                onClick={() => onEditMessage(index + 1)}
                                                title="Edit message"
                                            >
                                                <span className="codicon codicon-edit" />
                                            </VSCodeButton>
                                            <VSCodeButton
                                                appearance="icon"
                                                onClick={() =>
                                                    handleRedoMessage(index + 1, message.content)
                                                }
                                                title="Redo message"
                                            >
                                                <span className="codicon codicon-refresh" />
                                            </VSCodeButton>
                                            <VSCodeButton
                                                appearance="icon"
                                                onClick={() => onCopy(message.content)}
                                                title="Copy message"
                                            >
                                                <span className="codicon codicon-copy" />
                                            </VSCodeButton>
                                        </>
                                    )}
                                    {message.role === "assistant" && !message.isStreaming && (
                                        <VSCodeButton
                                            appearance="icon"
                                            onClick={() => onCopy(message.content)}
                                            title="Copy response"
                                        >
                                            <span className="codicon codicon-copy" />
                                        </VSCodeButton>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isStreaming && (
                            <div className="chat-message assistant">
                                {renderMessage(currentMessage)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="chat-empty-message">No messages yet. Start a conversation!</div>
                )}
            </div>

            <div className="input-container">
                <ChatInput
                    value={chatInput}
                    onChange={onChatInputChange}
                    onSubmit={onChatSubmit}
                    onFocus={onChatFocus}
                />
            </div>
        </div>
    );
}

export default React.memo(ChatTab);
