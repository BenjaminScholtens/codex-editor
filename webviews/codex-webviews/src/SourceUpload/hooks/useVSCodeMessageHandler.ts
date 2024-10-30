import { useCallback, useEffect, useState } from "react";
import { SourceUploadResponseMessages } from "../../../../../types";
import { WorkflowState, BibleDownloadStages } from "../types";

const vscode = acquireVsCodeApi();
const initialWorkflowState: WorkflowState = {
    step: "type-select",
    selectedFile: null,
    fileObject: null,
    processingStages: {},
    importType: null,
};

const getBibleDownloadStages = (): BibleDownloadStages => ({
    validation: {
        label: "Validation",
        description: "Validating Bible content",
        status: "pending",
    },
    download: {
        label: "Download",
        description: "Downloading Bible text",
        status: "pending",
    },
    splitting: {
        label: "Splitting",
        description: "Splitting into sections",
        status: "pending",
    },
    notebooks: {
        label: "Notebooks",
        description: "Creating notebooks",
        status: "pending",
    },
    metadata: {
        label: "Metadata",
        description: "Updating metadata",
        status: "pending",
    },
    commit: {
        label: "Commit",
        description: "Committing changes",
        status: "pending",
    },
});

export function useVSCodeMessageHandler() {
    const [workflow, setWorkflow] = useState<WorkflowState>(initialWorkflowState);

    const handleMessage = useCallback(
        (event: MessageEvent<SourceUploadResponseMessages>) => {
            const message = event.data;

            switch (message.command) {
                case "bibleDownloadProgress":
                    if (message.progress) {
                        setWorkflow((prev) => ({
                            ...prev,
                            step: "processing",
                            processingStages: Object.entries(message.progress?.status || {}).reduce(
                                (acc, [key, status]) => ({
                                    ...acc,
                                    [key]: {
                                        ...getBibleDownloadStages()[
                                            key as keyof BibleDownloadStages
                                        ],
                                        status,
                                    },
                                }),
                                prev.processingStages
                            ),
                            progress: {
                                message: message.progress.message || "",
                                increment: message.progress.increment || 0,
                            },
                        }));
                    }
                    break;

                case "bibleDownloadComplete":
                    setWorkflow((prev) => ({
                        ...prev,
                        step: "complete",
                        processingStages: Object.entries(getBibleDownloadStages()).reduce(
                            (acc, [key, stage]) => ({
                                ...acc,
                                [key]: { ...stage, status: "complete" },
                            }),
                            {}
                        ),
                        bibleDownload: {
                            ...prev.bibleDownload!,
                            status: "complete",
                        },
                    }));
                    break;

                case "availableCodexFiles":
                    if (message.files) {
                        setWorkflow((prev) => ({
                            ...prev,
                            availableCodexFiles: message.files,
                        }));
                    }
                    break;

                case "sourcePreview":
                    if (message.preview) {
                        setWorkflow((prev) => ({
                            ...prev,
                            step: "preview",
                            preview: {
                                type: "source",
                                fileName: message.preview.fileName,
                                fileSize: message.preview.fileSize,
                                fileType: message.preview.fileType,
                                original: message.preview.preview.original,
                                transformed: {
                                    sourceNotebooks:
                                        message.preview.preview.transformed.sourceNotebooks,
                                    codexNotebooks:
                                        message.preview.preview.transformed.codexNotebooks,
                                    validationResults:
                                        message.preview.preview.transformed.validationResults,
                                },
                            },
                        }));
                    }
                    break;

                case "bibleDownloadError":
                    if (message.error) {
                        setWorkflow((prev) => ({
                            ...prev,
                            error: message.error,
                            bibleDownload: {
                                ...prev.bibleDownload!,
                                status: "error",
                            },
                        }));
                    }
                    break;

                case "translationPreview":
                    if (message.preview) {
                        setWorkflow((prev) => ({
                            ...prev,
                            step: "preview",
                            preview: {
                                type: "translation",
                                fileName: message.preview.fileName,
                                fileSize: message.preview.fileSize,
                                fileType: message.preview.fileType,
                                original: message.preview.preview.original,
                                transformed: message.preview.preview.transformed,
                            },
                        }));
                    }
                    break;

                case "updateProcessingStatus":
                    if (message.status) {
                        setWorkflow((prev) => ({
                            ...prev,
                            step: "processing",
                            processingStages: Object.entries(message.status || {}).reduce(
                                (acc, [key, status]) => ({
                                    ...acc,
                                    [key]: {
                                        ...prev.processingStages[key],
                                        status,
                                    },
                                }),
                                prev.processingStages
                            ),
                        }));
                    }
                    break;

                case "importComplete":
                    setWorkflow((prev) => ({
                        ...prev,
                        step: "complete",
                    }));
                    break;

                case "error":
                    if (message) {
                        setWorkflow((prev) => ({
                            ...prev,
                            error: message.message,
                        }));
                    }
                    break;

                case "biblePreview":
                    if (message.preview) {
                        setWorkflow((prev) => ({
                            ...prev,
                            step: "preview",
                            preview: {
                                type: "bible",
                                original: message.preview.original,
                                transformed: message.preview.transformed,
                            },
                            currentTransaction: message.transaction,
                        }));
                    }
                    break;
            }
        },
        [setWorkflow]
    );

    useEffect(() => {
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleMessage]);

    return { vscode, workflow, setWorkflow };
}
