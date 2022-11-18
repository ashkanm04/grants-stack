import { datadogRum } from "@datadog/browser-rum";
import { BigNumber, ethers } from "ethers";
import { Dispatch } from "redux";
// import ProjectRegistryABI from "../contracts/abis/ProjectRegistry.json";
import RoundImplementationABI from "../contracts/abis/RoundImplementation.json";
import { addressesByChainID } from "../contracts/deployments";
import { global } from "../global";
import { RootState } from "../reducers";
import { Application, AppStatus } from "../reducers/projects";
import PinataClient from "../services/pinata";
import { ProjectEventsMap } from "../types";
import { graphqlFetch } from "../utils/graphql";
import { fetchGrantData } from "./grantsMetadata";
import generateUniqueRoundApplicationID from "../utils/roundApplication";

export const PROJECTS_LOADING = "PROJECTS_LOADING";
interface ProjectsLoadingAction {
  type: typeof PROJECTS_LOADING;
}

export const PROJECTS_LOADED = "PROJECTS_LOADED";
interface ProjectsLoadedAction {
  type: typeof PROJECTS_LOADED;
  events: ProjectEventsMap;
}

export const PROJECTS_ERROR = "PROJECTS_ERROR";
interface ProjectsErrorAction {
  type: typeof PROJECTS_ERROR;
  error: string;
}

export const PROJECTS_UNLOADED = "PROJECTS_UNLOADED";
export interface ProjectsUnloadedAction {
  type: typeof PROJECTS_UNLOADED;
}

export const PROJECT_APPLICATIONS_LOADING = "PROJECT_APPLICATIONS_LOADING";
interface ProjectApplicationsLoadingAction {
  type: typeof PROJECT_APPLICATIONS_LOADING;
  projectID: string;
}

export const PROJECT_APPLICATIONS_LOADED = "PROJECT_APPLICATIONS_LOADED";
interface ProjectApplicationsLoadedAction {
  type: typeof PROJECT_APPLICATIONS_LOADED;
  projectID: string;
  applications: Application[];
}

export const PROJECT_APPLICATIONS_ERROR = "PROJECT_APPLICATIONS_ERROR";
interface ProjectApplicationsErrorAction {
  type: typeof PROJECT_APPLICATIONS_ERROR;
  projectID: string;
  error: string;
}

export type ProjectsActions =
  | ProjectsLoadingAction
  | ProjectsLoadedAction
  | ProjectsErrorAction
  | ProjectsUnloadedAction
  | ProjectApplicationsLoadingAction
  | ProjectApplicationsLoadedAction
  | ProjectApplicationsErrorAction;

const projectsLoading = () => ({
  type: PROJECTS_LOADING,
});

const projectsLoaded = (events: ProjectEventsMap) => ({
  type: PROJECTS_LOADED,
  events,
});

const projectError = (error: string) => ({
  type: PROJECTS_ERROR,
  error,
});

const projectsUnload = () => ({
  type: PROJECTS_UNLOADED,
});

const fetchProjectCreatedEvents = async (chainID: number, account: string) => {
  const addresses = addressesByChainID(chainID!);
  // FIXME: use contract filters when fantom bug is fixed
  // const contract = new ethers.Contract(
  //   addresses.projectRegistry,
  //   ProjectRegistryABI,
  //   global.web3Provider!
  // );

  // FIXME: use this line when the fantom RPC bug has been fixed
  // const createdFilter = contract.filters.ProjectCreated(null, account) as any;
  const createdEventSig = ethers.utils.id("ProjectCreated(uint256,address)");
  const createdFilter = {
    address: addresses.projectRegistry,
    fromBlock: "0x00",
    toBlock: "latest",
    topics: [createdEventSig, null, ethers.utils.hexZeroPad(account, 32)],
  };

  // FIXME: remove when the fantom RPC bug has been fixed
  if (chainID === 250 || chainID === 4002) {
    createdFilter.address = undefined;
  }

  // FIXME: use queryFilter when the fantom RPC bug has been fixed
  // const createdEvents = await contract.queryFilter(createdFilter);
  let createdEvents = await global.web3Provider!.getLogs(createdFilter);

  // FIXME: remove when the fantom RPC bug has been fixed
  createdEvents = createdEvents.filter(
    (e) => e.address === addresses.projectRegistry
  );

  if (createdEvents.length === 0) {
    return {
      createdEvents: [],
      updatedEvents: [],
      ids: [],
    };
  }

  // FIXME: use this line when the fantom RPC bug has been fixed
  // const ids = createdEvents.map((event) => event.args!.projectID!.toNumber());
  const ids = createdEvents.map((event) => parseInt(event.topics[1], 16));

  // FIXME: use this line when the fantom RPC bug has been fixed
  // const hexIDs = createdEvents.map((event) =>
  //   event.args!.projectID!.toHexString()
  // );
  const hexIDs = createdEvents.map((event) => event.topics[1]);

  // FIXME: use this after fantom bug is fixed
  // const updatedFilter = contract.filters.MetadataUpdated(hexIDs);
  // const updatedEvents = await contract.queryFilter(updatedFilter);

  // FIXME: remove when fantom bug is fixed
  const updatedEventSig = ethers.utils.id(
    "MetadataUpdated(uint256,(uint256,string))"
  );
  const updatedFilter = {
    address: addresses.projectRegistry,
    fromBlock: "0x00",
    toBlock: "latest",
    topics: [updatedEventSig, hexIDs],
  };

  // FIXME: remove when the fantom RPC bug has been fixed
  if (chainID === 250 || chainID === 4002) {
    updatedFilter.address = undefined;
  }

  let updatedEvents = await global.web3Provider!.getLogs(updatedFilter);
  console.log(updatedEventSig);
  console.log(updatedFilter);
  // FIXME: remove when the fantom RPC bug has been fixed
  updatedEvents = updatedEvents.filter(
    (e) => e.address === addresses.projectRegistry
  );

  return {
    createdEvents,
    updatedEvents,
    ids,
  };
};

export const loadProjects =
  (withMetaData?: boolean) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    dispatch(projectsLoading());

    const state = getState();
    const { chainID, account } = state.web3;

    try {
      const { createdEvents, updatedEvents, ids } =
        await fetchProjectCreatedEvents(chainID!, account!);

      if (createdEvents.length === 0) {
        dispatch(projectsLoaded({}));
        return;
      }

      const events: ProjectEventsMap = {};

      createdEvents.forEach((createEvent) => {
        // FIXME: use this line when the fantom RPC bug has been fixed
        // const id = createEvent.args!.projectID!;
        const id = parseInt(createEvent.topics[1], 16);
        events[id] = {
          createdAtBlock: createEvent.blockNumber,
          updatedAtBlock: undefined,
        };
      });

      updatedEvents.forEach((updateEvent) => {
        // FIXME: use this line when the fantom RPC bug has been fixed
        // const id = BigNumber.from(updateEvent.args!.projectID!).toNumber();
        const id = BigNumber.from(updateEvent.topics[1]).toNumber();
        const event = events[id];
        if (event !== undefined) {
          event.updatedAtBlock = updateEvent.blockNumber;
        }
      });

      if (withMetaData) {
        ids.map((id) => dispatch<any>(fetchGrantData(id)));
      }

      dispatch(projectsLoaded(events));
    } catch (error) {
      dispatch(projectError("Cannot load projects"));
    }
  };

export const getApplicationStatusFromContract =
  // eslint-disable-next-line
  async (roundAddress: string, projectApplicationID: string) => {
    try {
      // query the subgraph for all rounds by the given account in the given program
      const contract = new ethers.Contract(
        roundAddress,
        RoundImplementationABI,
        global.web3Provider!
      );

      const result = await contract.projectsMetaPtr();
      const pinataClient = new PinataClient();
      const data = await pinataClient.fetchJson(result.pointer);
      const projectApplication = data.find((app: any) => {
        if (app.id === undefined) {
          return false;
        }

        // appId is in the form "projectApplicationID-roundAddress"
        const parts = app.id.split("-");
        if (parts[0] === projectApplicationID) {
          return true;
        }

        return false;
      });

      if (projectApplication !== undefined) {
        return projectApplication.status;
      }

      return undefined;
    } catch (error) {
      datadogRum.addError(error, { roundAddress });
      console.error("getApplicationStatusFromContract() error", {
        roundAddress,
        error,
      });
    }
  };

export const fetchProjectApplications =
  (projectID: string) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    dispatch({
      type: PROJECT_APPLICATIONS_LOADING,
      projectID,
    });

    const state = getState();
    const { chainID } = state.web3;
    const projectApplicationID = generateUniqueRoundApplicationID(
      chainID!,
      Number(projectID)
    );

    try {
      const response: any = await graphqlFetch(
        `query roundProjects($projectID: String) {
          roundProjects(where: { project: $projectID }) {
            status
            round {
              id
            }
          }
        }
        `,
        chainID!,
        { projectID: projectApplicationID }
      );

      const applications = response.data.roundProjects.map((rp: any) => ({
        status: rp.status,
        roundID: rp.round.id,
      }));

      // Update each application with the status from the contract
      // FIXME: This part can be removed when we are sure that the
      // aplication status returned from the graph is up to date.
      // eslint-disable-next-line
      for (let i = 0; i < applications.length; i++) {
        // eslint-disable-next-line
        const updatedStatus = await getApplicationStatusFromContract(
          applications[i].roundID,
          projectApplicationID
        );

        if (updatedStatus !== undefined) {
          applications[i].status = updatedStatus;
        }
      }

      dispatch({
        type: PROJECT_APPLICATIONS_LOADED,
        projectID,
        applications,
      });
    } catch (error: any) {
      datadogRum.addError(error, { projectID });
      dispatch({
        type: PROJECT_APPLICATIONS_ERROR,
        projectID,
        error: error.message,
      });
    }
  };

export const checkGrantApplicationStatus = async (
  id: any,
  projectsMetaPtr: any
): Promise<AppStatus> => {
  let reviewedApplications: any[] = [];

  const ipfsClient = new PinataClient();
  if (projectsMetaPtr) {
    reviewedApplications = await ipfsClient.fetchJson(projectsMetaPtr.pointer);
  }

  const obj = reviewedApplications.find((o) => o.id === id);

  return obj ? (obj.status as AppStatus) : "PENDING";
};

export const unloadProjects = () => projectsUnload();
