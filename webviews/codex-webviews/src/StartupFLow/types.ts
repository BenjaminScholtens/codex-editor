import { BiblePreviewData, PreviewContent } from "../../../../types";
import { DownloadBibleTransaction } from "../../../../src/transactions/DownloadBibleTransaction";

// Add ImportType type
export type ImportType = "source" | "translation" | "bible-download";

// Update WorkflowStep to include the new initial steps
export type WorkflowStep = "auth" | "project-select" | "type-select" | "select" | "preview" | "processing" | "complete";

export type ProcessingStatus = "pending" | "active" | "complete" | "error";

export interface ProcessingStage {
    label: string;
    description: string;
    status: ProcessingStatus;
}

export interface ProcessingStages {
    [key: string]: ProcessingStage;
}

// Add specific Bible download stages
export interface BibleDownloadStages extends ProcessingStages {
    validation: ProcessingStage;
    download: ProcessingStage;
    splitting: ProcessingStage;
    notebooks: ProcessingStage;
    metadata: ProcessingStage;
    commit: ProcessingStage;
}

// Add Bible download specific state
export interface BibleDownloadState {
    language: string;
    translationId: string;
    status: "idle" | "downloading" | "complete" | "error";
    progress?: {
        stage: keyof BibleDownloadStages;
        message: string;
        increment: number;
    };
}

// Add project selection type
export type ProjectSelectionType = "clone" | "open" | "new";

// Add authentication state interface
export interface AuthState {
    isAuthenticated: boolean;
    isAuthExtensionInstalled: boolean;
    isLoading: boolean;
    error?: string;
}

// Add project selection state interface
export interface ProjectSelectionState {
    type?: ProjectSelectionType;
    path?: string;
    repoUrl?: string;
    error?: string;
}

export interface MultiPreviewItem {
    id: string; // Unique ID for each preview
    fileName: string;
    fileSize: number;
    isValid: boolean;
    isRejected?: boolean;
    preview: PreviewContent | BiblePreviewData;
    sourceId?: string; // Optional sourceId for translation previews
}

export interface CodexFile {
    id: string;
    name: string;
    path: string;
}

export interface TranslationAssociation {
    file: File;
    codexId: string;
}

export interface WorkflowState {
    step: WorkflowStep;
    importType: ImportType | null;
    authState: AuthState;
    projectSelection: ProjectSelectionState;
    selectedFiles: string[];
    fileObjects: File[];
    selectedSourceId?: string;
    preview?: PreviewContent | BiblePreviewData;
    error?: string | null;
    processingStages: ProcessingStages | BibleDownloadStages;
    progress?: {
        message: string;
        increment: number;
    };
    availableCodexFiles?: CodexFile[];
    bibleDownload?: BibleDownloadState;
    currentTransaction?: DownloadBibleTransaction;
    previews: MultiPreviewItem[];
    selectedPreviewId?: string;
    translationAssociations: TranslationAssociation[];
}

export interface ImportProgress {
    message: string;
    increment: number;
}
