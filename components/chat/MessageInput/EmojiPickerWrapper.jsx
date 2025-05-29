import EmojiPicker from "emoji-picker-react";

export const EmojiPickerWrapper = ({
  newMessage,
  setNewMessage,
  setShowEmojiPicker,
  textareaRef,
}) => {
  const handleEmojiClick = (emojiObject) => {
    const emoji = emojiObject.emoji;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        newMessage.substring(0, start) + emoji + newMessage.substring(end);
      setNewMessage(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setNewMessage((prev) => prev + emoji);
    }
  };

  return (
    <div className="absolute bottom-full left-0 mb-4 z-50">
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        width={300}
        height={400}
        theme="light"
        lazyLoadEmojis={true}
        emojiStyle="native"
      />
    </div>
  );
};
