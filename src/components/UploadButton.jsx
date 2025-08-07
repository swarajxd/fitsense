import React from "react";
import { FaPlus } from "react-icons/fa";
import "./UploadButton.css";

const UploadButton = () => {
  return (
    <div className="upload-button">
      <FaPlus className="plus-icon" />
    </div>
  );
};

export default UploadButton;
