/**
 * @module Spatiality.ProjectsList
 * @description WebComponent that manages the list of user's projects.
 * @author William Martin
 * @version 0.1.0
 */
 
class ProjectsList extends HTMLElement {
  constructor () {
    super();

    const template = document.getElementById('projects-list-template');
    const templateContent = template.content;
    
    // Create shadow DOM and append template
    this.attachShadow({ mode: 'open' });

    this.shadowRoot.appendChild(templateContent.cloneNode(true));
  }
  
  connectedCallback () {
    const newProjectButton = this.shadowRoot.querySelector('#new-project');
    newProjectButton.addEventListener('click', event => {
      this.state.currentProject.reset();
      this.state.createProject(this.updateCurrentProjectInput);
    });
    
    const saveProjectButton = this.shadowRoot.querySelector('#save-project');
    saveProjectButton.addEventListener('click', event => {
      this.state.saveCurrentProject();
    });
    
    const deleteProjectButton = this.shadowRoot.querySelector('#delete-project');
    deleteProjectButton.addEventListener('click', event => {
      this.state.deleteCurrentProject(this.updateCurrentProjectInput);
    });
  }
  
  updateCurrentProjectInput (projectObj) {
    const projectNameInput = document.getElementById('project-name-input');
    projectNameInput.value = projectObj.name;
  }
  
  populate (state) {
    this.state = state;

    const listRef = this.shadowRoot.querySelector('.projects');
    for (const project of state.projects) {
      this.addProject(project, listRef);
    }
  }
  
  addProject (projectJson, listRef=null) {
    const list = listRef || this.shadowRoot.querySelector('.projects');
    const item = document.createElement('button');
    
    item.classList.add('project');
    item.id = projectJson.id;
    item.innerText = projectJson.name;
    
    if (projectJson.id === this.state.currentProject?.id) {
      item.classList.add('current');
    } else {
      item.classList.remove('current');
    }
    
    item.addEventListener('click', event => {
      if (this.state.currentProject.id === projectJson.id) { return; }
      
      console.log(`Opening project ${projectJson.name} ${projectJson.id}`);
      
      // This behavior saves the current project if a change has been made.
      // Not sure if this is really in the right place.
      if (this.state.currentProject.hasChanged) {
        this.state.saveCurrentProject();
        this.state.currentProject.reset();
      } else {
        console.log("No change detected in current project. Skipping save.");
        this.state.currentProject.reset();
        this.state.removeProject(this.state.currentProject.id);
      }
      
      this.state.openProject(projectJson.id, this.updateCurrentProjectInput);
    });
    
    list.appendChild(item);
  }
  
  updateProjectsList () {
    const projects = this.shadowRoot.querySelectorAll('.project');
    for (const project of projects) {
      project.classList.remove('current');
      if (project.id === this.state.currentProject.id) {
        project.classList.add('current');
      }
    }
  }
  
  updateProjectName (projectId, newName) {
    const projectListItem = this.shadowRoot.getElementById(projectId);
    if (projectListItem) {
      projectListItem.innerText = newName;
    }
  }
  
  removeProject (projectId) {
    const projectListItem = this.shadowRoot.getElementById(projectId);
    if (projectListItem) {
      projectListItem.remove();
    }
  }
}

// Define the custom element
customElements.define('projects-list', ProjectsList);
