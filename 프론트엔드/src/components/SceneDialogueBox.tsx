import './SceneDialogueBox.css';

type SceneDialogueBoxProps = {
  message?: string | null;
};

export function SceneDialogueBox({ message }: SceneDialogueBoxProps) {
  const text = message?.trim();
  if (!text) return null;

  return (
    <div className="scene-dialogue" role="status" aria-live="polite" aria-label="행동 안내">
      <div className="scene-dialogue__panel">
        <p className="scene-dialogue__text">{text}</p>
      </div>
    </div>
  );
}
