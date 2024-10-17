import React, { useEffect, useRef } from "react";
import TimeLine, { TimelineReturn } from "./T";
import "./index.css";

export interface TimelineProps {
    changeAreaShow: (beginingTimeShow: number, endTimeShow: number) => void;
    changeZoomLevel: (zoomLevel: number) => void;
    changeShift: (shift: number) => void;
    setAligns: (
        alignments: {
            begin: number;
            end: number;
            text: string;
        }[]
    ) => void;
    audioRef?: React.RefObject<HTMLAudioElement>;
    src: string;
    data: {
        begin: number;
        end: number;
        text: string;
    }[];
    autoScroll: boolean;
    colors: {
        background: string;
        box: string;
        boxHover: string;
        selectedBox: string;
        playingBox: string;
        text: string;
        selectedText: string;
        tooltipBackground: string;
        tooltipText: string;
        scrollBarBackground: string;
        scrollBar: string;
        scrollBarHover: string;
    };
    paddingLeft?: number;
}

export default function Timeline(props: TimelineProps) {
    let timeLine: TimelineReturn;
    let shift: number;
    let zoomLevel: number;
    let data: {
        begin: number;
        end: number;
        text: string;
    }[];
    let beginingTimeShow: number;
    let endTimeShow: number;
    const canvas1 = useRef(null);
    const canvasAudio = useRef(null);
    const canvas2 = useRef(null);

    const changeAlignment = (z: typeof data) => {
        data = z;
        props.setAligns(z);
    };
    const changeZoomLevel = (z: number) => {
        props.changeZoomLevel(z);
        zoomLevel = z;
    };
    const changeShift = (s: number) => {
        props.changeShift(s);
        shift = s;
    };

    const changeAreaShow = (b: number, e: number) => {
        props.changeAreaShow(b, e);
        beginingTimeShow = b;
        endTimeShow = e;
    };

    const defaultFunction = () => {};
    const drawTimeLine = (p: TimelineProps & { endTime: number }) => {
        timeLine = TimeLine(
            canvas1.current as unknown as HTMLCanvasElement,
            canvas2.current as unknown as HTMLCanvasElement,
            p.data,
            p.endTime,
            () => (props.audioRef ? props.audioRef.current : canvasAudio.current),
            changeAlignment || defaultFunction,
            changeZoomLevel || defaultFunction,
            changeShift || defaultFunction,
            changeAreaShow || defaultFunction,
            {
                autoScroll: props.autoScroll,
                colors: {
                    background: props.colors?.background || "transparent",
                    box: props.colors?.box || "#a9a9a9",
                    boxHover: props.colors?.boxHover || "#80add6",
                    selectedBox: props.colors?.selectedBox || "#1890ff",
                    playingBox: props.colors?.playingBox || "#f0523f",
                    text: props.colors?.text || "#212b33",
                    selectedText: props.colors?.selectedText || "white",
                    tooltipBackground: props.colors?.tooltipBackground || "#474e54",
                    tooltipText: props.colors?.tooltipText || "white",
                    scrollBarBackground: props.colors?.scrollBarBackground || "#f1f3f9",
                    scrollBar: props.colors?.scrollBar || "#c2c9d6",
                    scrollBarHover: props.colors?.scrollBarHover || "#8f96a3",
                },
            }
        );
    };

    useEffect(() => {
        let endTime;
        if (props.data.length > 0 && props.src) {
            endTime = props.data[props.data.length - 1]
                ? props.data[props.data.length - 1].end * 1.2
                : 60;
            if (props.data[props.data.length - 1].end > endTime) {
                endTime = props.data[props.data.length - 1].end;
                console.log("Video time is less than the alignments end time");
            }

            drawTimeLine({ ...props, endTime });
        }

        return () => {
            if (timeLine) timeLine.cancelAnimate();
        };
    }, [props.data, props.src]);

    const style = {
        height: "90px",
        paddingLeft: props.paddingLeft,
    };

    return (
        <div style={style} className="timeline-editor">
            <div hidden>
                <audio src={props.src} ref={props.audioRef || canvasAudio} />
            </div>
            <div className="wrap z-index-2">
                <canvas ref={canvas1}></canvas>
            </div>
            <div className="wrap z-index-1">
                <canvas ref={canvas2}></canvas>
            </div>
        </div>
    );
}
