/**
 * @module Spaciality.OpenAIInterface
 * @description A convenience interface for OpenAI.
 * @author William Martin
 * @version 0.1.0
 */

import * as Interface from './interface.js';
import { Chat } from './chat.js';
import OpenAI from 'openai';
import * as Messages from './messages-list.js';

const API_STORAGE_KEY = 'spatiality-openai-api-key';

export class OpenAIInterface {
  constructor () {
    this.state = null;
    this._openai = null;
  }
  
  async initialize (state, interfaceState) {
    this.state = state;
    this.initializeUIBehaviors(interfaceState);
  }
  
  // =============================================================================
  // UI Stuff - TODO: Consider moving to its own module.
  
  initializeUIBehaviors (interfaceState) {
    this.addStorageBehaviorToApiKeyInput();
    this.addToggleVisibilityButton();
    this.initializePromptInputs();
    this.initializeContextWindow();
    this.updateApiNoticeVisibility();
  }
  
  updateApiNoticeVisibility () {
    if (this.hasApiKey) {
      Interface.hideElementById('api-key-notice');
    } else {
      Interface.showElementById('api-key-notice');
    }
  }
  
  addStorageBehaviorToApiKeyInput () {
    const _this = this;
    const apiKeyInput = document.getElementById('openai-api-key');
    apiKeyInput.addEventListener('change', event => {
      const key = event.target.value;
      _this.apiKey = key;
      _this.updateApiNoticeVisibility();
    });
    
    if (this.hasApiKey) {
      apiKeyInput.value = this.apiKey;
    }
  }
  
  addToggleVisibilityButton () {
    const togglePasswordVisibility = () => {
      const apiKeyInput = document.getElementById('openai-api-key');
      if (apiKeyInput.type === 'text') {
        apiKeyInput.type = 'password';
      } else {
        apiKeyInput.type = 'text';
      }
    };
    
    const toggleButton = document.getElementById('toggle-openai-key-visibility');
    toggleButton.addEventListener('click', togglePasswordVisibility);
  }
  
  initializePromptInputs () {
    const promptInput = document.getElementById('prompt-input');
    
    if (!promptInput) {
      throw new Error(`Couldn't find the prompt input!`);
    }
    
    const submit = async () => {
      promptInput.disabled = true;
      
      // Get the text from the text input element.
      const prompt = promptInput.value;
      
      // Call the OpenAI API to get a completion from the prompt.
      const completion = await this.chat(prompt);
      
      promptInput.value = '';
      promptInput.disabled = false;
      
      this.state.saveCurrentProject();
    };
    
    promptInput.addEventListener('keydown', async event => {
      if (event.key === "Enter") {
        event.preventDefault();
        await submit();
      }
    });
    
    Interface.initializeButton("#send-prompt", submit.bind(this));
  }
  
  initializeContextWindow () {
    Interface.initializeTextInput('#context-window', (value, event) => {
      this.state.currentProject.defaultContext = value;
    }, () => this.state.currentProject.defaultContext);
  }
  
  populateContextWindow (context) {
    const contextWindow = document.querySelector('#context-window');
    contextWindow.value = context;
  }
  
  enableContextWindow () {
    const contextWindow = document.querySelector('#context-window');
    contextWindow.disabled = false;
  }
  
  disableContextWindow () {
    const contextWindow = document.querySelector('#context-window');
    contextWindow.disabled = true;
  }
  
  // =============================================================================
  // API Key Management
  
  set apiKey (newKey) {
    localStorage.setItem(API_STORAGE_KEY, newKey);
  }
  
  get apiKey () {
    return localStorage.getItem(API_STORAGE_KEY);
  }
  
  get hasApiKey () {
    const key = this.apiKey;
    return key && (typeof key === 'string') && key.length > 40;
  }
  
  instantiate () {
    this.updateApiNoticeVisibility();

    if (!this.hasApiKey) {
      alert("Remember to enter your OpenAI API key.");
      return false;
    }

    this._openai = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true, // HACK
    });

    return true;
  }
  
  // =============================================================================
  // Chat

  // Sends a single prompt to the OpenAI completions API.
  // Accepts a few arguments:
  // - prompt: a string, user-provided prompt
  // TODO: there's probably a better way to handle UI updates, but some responses
  // we want to show but aren't actually messages of the chat itself.
  async chat (prompt) {
    console.log(`Attempting to chat via OpenAI API with prompt:`, prompt);

    const chat = this.state.currentChat;
    const toolSchemas = this.state.currentSimulation.toolSchemas;
    const availableFunctions = this.state.currentSimulation.availableFunctions;
    
    try {
      if (!this._openai) {
        this.instantiate();
      }
      
      // Add the user's prompt to the list regardless of whether an error is thrown.
      const newMessage = {
        "role": "user",
        "content": prompt
      };
      Messages.addMessageToList(prompt);
      
      if (!this._openai) {
        throw new Error("Tried to chat with OpenAI but the OpenAI instance wasn't ready. Perhaps a missing API key?");
      }
      
      // Now that the OpenAI instance has been instantiated, ensure the
      // default context is added.
      if (!chat.isReady) {
        chat.setDefaultContext(this.state.currentProject.defaultContext);
        this.disableContextWindow();
      }
      
      // add the prompt
      // to the list of messages. This ensures the chat's continuity.
      chat.addMessage(newMessage);
      
      const completion = await this._openai.chat.completions.create({
        model: chat.model,
        messages: chat.messages,
        tools: toolSchemas,
      });
      
      // I think regardless, we want to store the first response.
      const responseMessage = completion.choices[0].message;
      chat.addMessage(responseMessage);
      const responseContent = responseMessage.content;

      if (responseMessage.tool_calls) {
        const tool_names = responseMessage.tool_calls.map(t => t.function.name).join(', ');

        Messages.addMessageToList('··· ' + (responseContent || `Response requires calling function(s): ${tool_names}`));
        
        // In this case, the response has asked to call one or more tools to get enough information
        // to complete the chat.

        for (const tool_call of responseMessage.tool_calls) {
          const function_name = tool_call.function.name;
  
          Messages.addMessageToList(`··· Calling function ${function_name}:`);
          
          const function_to_call = availableFunctions[function_name];
          const function_args = JSON.parse(tool_call.function.arguments);
  
          console.log('··· Calling function:', function_name, ', with the arguments:', function_args);
  
          const function_result = function_to_call(function_args);
          
          console.log('··· Function result:', function_result);
          
          // Extend conversation with function's response.
          const functionResponseMessage = {
            "tool_call_id": tool_call.id,
            "role": "tool",
            "name": function_name,
            "content": function_result,
          };
          chat.addMessage(functionResponseMessage);
        } // end loop of function calls
        
        // Once all the tools have been called and the results compiled, then get back
        // to OpenAI with the results.
        const function_completion = await this._openai.chat.completions.create({
          model: chat.model,
          messages: chat.messages,
          // Do we omit 'tools' on purpose here?
        });
        
        const secondResponseMessage = function_completion.choices[0].message;
        chat.addMessage(secondResponseMessage);
  
        const secondResponseContent = secondResponseMessage.content;
        Messages.addMessageToList('→ ' + secondResponseContent);
        return secondResponseContent;
      } else {
        // Normal path with no tool calls.
        const responseContent = completion.choices[0].message.content;
        
        Messages.addMessageToList('→ ' + responseContent);
        return responseContent;
      }
    } catch (err) {
      console.error("An error occurred in the chat function:", err);
      // Note that this ends up being the completion returned by chat().
      return `An error occurred. ${err.name} | ${err.message}`;
    }
  } // end chat
} // end OpenAI
