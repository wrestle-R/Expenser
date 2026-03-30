"use client";
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export default function Test() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div className="bg-red-500 p-4">I am a div</div>} />
        <TooltipContent>Content</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<button className="bg-blue-500" />}>I am a button child</TooltipTrigger>
        <TooltipContent>Content2</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
