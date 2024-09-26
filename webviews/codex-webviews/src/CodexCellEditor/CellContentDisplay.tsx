import React from "react";
import { EditorVerseContent, EditorPostMessages } from "../../../../types";
import { HACKY_removeContiguousSpans } from "./utils";
import { CodexCellTypes } from "../../../../types/enums";

interface CellContentDisplayProps {
    cellIds: string[];
    cellContent: string;
    cellIndex: number;
    cellType: CodexCellTypes;
    setContentBeingUpdated: React.Dispatch<React.SetStateAction<EditorVerseContent>>;
    vscode: any;
    textDirection: "ltr" | "rtl";
}

const CellContentDisplay: React.FC<CellContentDisplayProps> = ({
    cellIds,
    cellContent,
    cellType,
    setContentBeingUpdated,
    vscode,
    textDirection,
}) => {
    const handleVerseClick = () => {
        setContentBeingUpdated({
            verseMarkers: cellIds,
            content: cellContent,
        });
        vscode.postMessage({
            command: "setCurrentIdToGlobalState",
            content: { currentLineId: cellIds[0] },
        } as EditorPostMessages);
    };
    const verseMarkerVerseNumbers = cellIds.map((cellMarker) => {
        const parts = cellMarker?.split(":");
        return parts?.[parts.length - 1];
    });
    let verseRefForDisplay = "";
    if (verseMarkerVerseNumbers.length === 1) {
        verseRefForDisplay = verseMarkerVerseNumbers[0];
    } else {
        verseRefForDisplay = `${verseMarkerVerseNumbers[0]}-${
            verseMarkerVerseNumbers[verseMarkerVerseNumbers.length - 1]
        }`;
    }
    // FIXME: we need to allow for the ref/id to be displayed at the start or end of the cell
    return (
        <span className="verse-display" onClick={handleVerseClick} style={{ direction: textDirection }}>
            {cellType === CodexCellTypes.TEXT && <sup>{verseRefForDisplay}</sup>}
            <span
                dangerouslySetInnerHTML={{
                    __html: HACKY_removeContiguousSpans(cellContent),
                }}
            />
        </span>
    );
};

export default CellContentDisplay;
